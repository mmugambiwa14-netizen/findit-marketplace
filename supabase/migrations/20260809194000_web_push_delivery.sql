-- Upgrade the existing PeekaListing Web Push foundation in place.
-- Canonical notifications remain public.app_alerts; subscriptions keep the
-- established enabled/last_seen_at lifecycle and delivery keeps the existing
-- public.web_push_delivery_jobs queue.

begin;

alter table public.web_push_subscriptions
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_at timestamptz;

alter table public.web_push_delivery_jobs
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

create index if not exists web_push_delivery_jobs_claim_idx
  on public.web_push_delivery_jobs(status, available_at, id)
  where status in ('pending','processing');

create or replace function private.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default 'web'
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
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if length(trim(coalesce(p_endpoint,''))) < 20
     or length(trim(coalesce(p_p256dh,''))) < 20
     or length(trim(coalesce(p_auth,''))) < 8 then
    raise exception 'invalid push subscription' using errcode='22023';
  end if;

  insert into public.web_push_subscriptions
    (user_id, endpoint, p256dh, auth, user_agent, platform, enabled, last_seen_at,
     failure_count, last_success_at, last_failure_at, updated_at)
  values
    (v_user_id, trim(p_endpoint), trim(p_p256dh), trim(p_auth), left(p_user_agent,500),
     left(coalesce(p_platform,'web'),40), true, now(), 0, null, null, now())
  on conflict (endpoint) do update set
    user_id=excluded.user_id,
    p256dh=excluded.p256dh,
    auth=excluded.auth,
    user_agent=excluded.user_agent,
    platform=excluded.platform,
    enabled=true,
    last_seen_at=now(),
    failure_count=0,
    last_failure_at=null,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function private.disable_web_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $function$
  update public.web_push_subscriptions
  set enabled=false, updated_at=now()
  where user_id=auth.uid() and endpoint=p_endpoint;
$function$;

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
    select j.id
    from public.web_push_delivery_jobs j
    where (
      j.status='pending'
      or (j.status='processing' and coalesce(j.lease_expires_at,j.locked_at) < now())
    )
      and j.available_at <= now()
    order by j.id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), leased as (
    update public.web_push_delivery_jobs j
       set status='processing',
           attempts=j.attempts+1,
           locked_at=now(),
           lease_token=gen_random_uuid(),
           lease_expires_at=now()+interval '2 minutes',
           updated_at=now()
      from candidates c
     where j.id=c.id
    returning j.*
  )
  select l.id,
         l.lease_token,
         a.id,
         a.user_id,
         coalesce(a.event_type,'account_status'),
         a.title,
         a.message,
         case when public.is_safe_notification_link(a.link) then a.link else '/notifications' end,
         a.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth
           ) order by s.created_at,s.id)
           from public.web_push_subscriptions s
           where s.user_id=a.user_id and s.enabled
         ),'[]'::jsonb)
  from leased l
  join public.app_alerts a on a.id=l.alert_id;
end;
$function$;

create or replace function private.complete_web_push_delivery(
  p_delivery_id bigint,
  p_lease_token uuid,
  p_delivered boolean,
  p_delivered_count integer default 0,
  p_failed_count integer default 0,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.web_push_delivery_jobs
     set status=case
       when p_delivered and coalesce(p_failed_count,0) > 0 then 'partial'
       when p_delivered then 'delivered'
       when attempts >= 5 then 'failed'
       else 'pending'
     end,
     delivered_count=greatest(0,coalesce(p_delivered_count,0)),
     failed_count=greatest(0,coalesce(p_failed_count,0)),
     available_at=case
       when p_delivered or attempts >= 5 then available_at
       else now()+make_interval(secs=>least(3600,15*(2^greatest(attempts-1,0))))
     end,
     locked_at=null,
     lease_token=null,
     lease_expires_at=null,
     last_error=case when p_delivered and coalesce(p_failed_count,0)=0 then null else left(coalesce(p_error,'delivery failed'),1000) end,
     updated_at=now()
   where id=p_delivery_id and lease_token=p_lease_token and status='processing';
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
     set enabled=case when p_permanent_failure then false else enabled end,
         failure_count=case when p_success then 0 else failure_count+1 end,
         last_success_at=case when p_success then now() else last_success_at end,
         last_failure_at=case when p_success then last_failure_at else now() end,
         last_seen_at=case when p_success then now() else last_seen_at end,
         updated_at=now()
   where id=p_subscription_id;
end;
$function$;

create or replace function public.claim_web_push_deliveries(p_limit integer default 25)
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
language sql
security definer
set search_path=''
as $wrapper$ select * from private.claim_web_push_deliveries($1); $wrapper$;

create or replace function public.complete_web_push_delivery(
  p_delivery_id bigint,
  p_lease_token uuid,
  p_delivered boolean,
  p_delivered_count integer default 0,
  p_failed_count integer default 0,
  p_error text default null
)
returns void
language sql
security definer
set search_path=''
as $wrapper$ select private.complete_web_push_delivery($1,$2,$3,$4,$5,$6); $wrapper$;

create or replace function public.record_web_push_subscription_result(
  p_subscription_id uuid,
  p_success boolean,
  p_permanent_failure boolean default false
)
returns void
language sql
security definer
set search_path=''
as $wrapper$ select private.record_web_push_subscription_result($1,$2,$3); $wrapper$;

revoke all on function private.claim_web_push_deliveries(integer) from public,anon,authenticated;
revoke all on function private.complete_web_push_delivery(bigint,uuid,boolean,integer,integer,text) from public,anon,authenticated;
revoke all on function private.record_web_push_subscription_result(uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.claim_web_push_deliveries(integer) from public,anon,authenticated;
revoke all on function public.complete_web_push_delivery(bigint,uuid,boolean,integer,integer,text) from public,anon,authenticated;
revoke all on function public.record_web_push_subscription_result(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.claim_web_push_deliveries(integer) to service_role;
grant execute on function public.complete_web_push_delivery(bigint,uuid,boolean,integer,integer,text) to service_role;
grant execute on function public.record_web_push_subscription_result(uuid,boolean,boolean) to service_role;

-- Foreground notifications consume the canonical app_alerts rows. Add the table
-- to Realtime once without disturbing existing publication membership.
do $publication$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='app_alerts'
     ) then
    alter publication supabase_realtime add table public.app_alerts;
  end if;
end;
$publication$;

commit;
