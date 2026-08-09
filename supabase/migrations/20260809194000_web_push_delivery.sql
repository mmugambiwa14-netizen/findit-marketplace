-- Production Web Push delivery foundation for PeekaListing.
-- Extends canonical public.notifications with per-device subscriptions and a
-- leased delivery outbox. Push payloads intentionally carry conservative text.

begin;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

alter table public.web_push_subscriptions enable row level security;

revoke all on public.web_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.web_push_subscriptions to authenticated;

create policy web_push_subscriptions_own_select
  on public.web_push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy web_push_subscriptions_own_insert
  on public.web_push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy web_push_subscriptions_own_update
  on public.web_push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy web_push_subscriptions_own_delete
  on public.web_push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_endpoint, ''))) < 16
     or length(trim(coalesce(p_p256dh, ''))) < 16
     or length(trim(coalesce(p_auth, ''))) < 8 then
    raise exception 'invalid push subscription' using errcode = '22023';
  end if;

  insert into public.web_push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, platform, active, failure_count, updated_at)
  values (v_user_id, trim(p_endpoint), trim(p_p256dh), trim(p_auth), left(p_user_agent, 1024), left(p_platform, 64), true, 0, now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        platform = excluded.platform,
        active = true,
        failure_count = 0,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.disable_web_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.web_push_subscriptions
     set active = false, updated_at = now()
   where user_id = auth.uid() and endpoint = p_endpoint;
end;
$function$;

revoke all on function public.register_web_push_subscription(text,text,text,text,text) from public, anon;
grant execute on function public.register_web_push_subscription(text,text,text,text,text) to authenticated;
revoke all on function public.disable_web_push_subscription(text) from public, anon;
grant execute on function public.disable_web_push_subscription(text) to authenticated;

create table if not exists private.web_push_delivery_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','leased','retrying','delivered','abandoned')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id)
);

create index if not exists web_push_delivery_outbox_ready_idx
  on private.web_push_delivery_outbox(status, available_at, id)
  where status in ('pending','retrying');

create or replace function private.enqueue_web_push_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  insert into private.web_push_delivery_outbox(notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;
  return new;
end;
$function$;

drop trigger if exists notifications_enqueue_web_push on public.notifications;
create trigger notifications_enqueue_web_push
after insert on public.notifications
for each row execute function private.enqueue_web_push_delivery();

create or replace function private.claim_web_push_deliveries(p_limit integer default 25)
returns table(
  delivery_id bigint,
  lease_token uuid,
  notification_id uuid,
  user_id uuid,
  event_type text,
  title text,
  body text,
  link text,
  created_at timestamptz,
  subscriptions jsonb
)
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  return query
  with candidates as (
    select o.id
    from private.web_push_delivery_outbox o
    where o.status in ('pending','retrying')
      and o.available_at <= now()
      and (o.lease_expires_at is null or o.lease_expires_at < now())
    order by o.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,25),100))
  ), leased as (
    update private.web_push_delivery_outbox o
       set status='leased', lease_token=gen_random_uuid(), lease_expires_at=now()+interval '2 minutes',
           attempt_count=o.attempt_count+1, updated_at=now()
      from candidates c
     where o.id=c.id
    returning o.*
  )
  select l.id, l.lease_token, n.id, n.user_id, n.event_type, n.title,
         n.message, n.link, n.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth
           ))
           from public.web_push_subscriptions s
           where s.user_id=n.user_id and s.active
         ), '[]'::jsonb)
  from leased l join public.notifications n on n.id=l.notification_id;
end;
$function$;

create or replace function private.complete_web_push_delivery(
  p_delivery_id bigint,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = private
as $function$
begin
  update private.web_push_delivery_outbox
     set status = case
       when p_delivered then 'delivered'
       when attempt_count >= 5 then 'abandoned'
       else 'retrying'
     end,
     available_at = case when p_delivered or attempt_count >= 5 then available_at
                         else now() + make_interval(secs => least(3600, 15 * (2 ^ greatest(attempt_count-1,0)))) end,
     lease_token=null, lease_expires_at=null,
     last_error=case when p_delivered then null else left(coalesce(p_error,'delivery failed'),1000) end,
     updated_at=now()
   where id=p_delivery_id and lease_token=p_lease_token and status='leased';
end;
$function$;

create or replace function private.record_web_push_subscription_result(
  p_subscription_id uuid,
  p_success boolean,
  p_permanent_failure boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.web_push_subscriptions
     set active = case when p_permanent_failure then false else active end,
         failure_count = case when p_success then 0 else failure_count + 1 end,
         last_success_at = case when p_success then now() else last_success_at end,
         last_failure_at = case when p_success then last_failure_at else now() end,
         updated_at=now()
   where id=p_subscription_id;
end;
$function$;

revoke all on function private.claim_web_push_deliveries(integer) from public, anon, authenticated;
revoke all on function private.complete_web_push_delivery(bigint,uuid,boolean,text) from public, anon, authenticated;
revoke all on function private.record_web_push_subscription_result(uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function private.claim_web_push_deliveries(integer) to service_role;
grant execute on function private.complete_web_push_delivery(bigint,uuid,boolean,text) to service_role;
grant execute on function private.record_web_push_subscription_result(uuid,boolean,boolean) to service_role;

commit;
