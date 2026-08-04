create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text not null default 'web',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists web_push_subscriptions_user_enabled_idx
  on public.web_push_subscriptions (user_id, enabled) where enabled;

alter table public.web_push_subscriptions enable row level security;
create policy "users_manage_own_web_push_subscriptions"
  on public.web_push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.web_push_delivery_jobs (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.app_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','delivered','partial','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id)
);

create index if not exists web_push_delivery_jobs_pending_idx
  on public.web_push_delivery_jobs (available_at, id) where status in ('pending','failed');
alter table public.web_push_delivery_jobs enable row level security;

create or replace function public.enqueue_web_push_for_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.web_push_subscriptions where user_id = new.user_id and enabled) then
    insert into public.web_push_delivery_jobs (alert_id, user_id)
    values (new.id, new.user_id) on conflict (alert_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_web_push_for_alert() from public;

drop trigger if exists app_alerts_enqueue_web_push on public.app_alerts;
create trigger app_alerts_enqueue_web_push after insert on public.app_alerts
for each row execute function public.enqueue_web_push_for_alert();

create or replace function public.register_web_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_user_agent text default null, p_platform text default 'web'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if length(coalesce(p_endpoint,'')) < 20 or length(coalesce(p_p256dh,'')) < 20 or length(coalesce(p_auth,'')) < 8 then
    raise exception 'invalid push subscription';
  end if;
  insert into public.web_push_subscriptions
    (user_id, endpoint, p256dh, auth, user_agent, platform, enabled, last_seen_at, updated_at)
  values
    (v_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent,500), left(coalesce(p_platform,'web'),40), true, now(), now())
  on conflict (endpoint) do update set
    user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth,
    user_agent=excluded.user_agent, platform=excluded.platform,
    enabled=true, last_seen_at=now(), updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.register_web_push_subscription(text,text,text,text,text) to authenticated;

create or replace function public.disable_web_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update public.web_push_subscriptions set enabled=false, updated_at=now()
  where user_id=auth.uid() and endpoint=p_endpoint;
$$;
grant execute on function public.disable_web_push_subscription(text) to authenticated;
