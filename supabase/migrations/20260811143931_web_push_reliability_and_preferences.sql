begin;

-- ---------------------------------------------------------------------------
-- Notification delivery preferences
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  in_app_sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;

drop policy if exists notification_preferences_owner_access on public.notification_preferences;
create policy notification_preferences_owner_access
  on public.notification_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create or replace function private.get_notification_preferences()
returns table (
  push_enabled boolean,
  in_app_sound_enabled boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  insert into public.notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return query
  select p.push_enabled, p.in_app_sound_enabled
  from public.notification_preferences p
  where p.user_id = v_user_id;
end;
$function$;

create or replace function private.update_notification_preferences(
  p_push_enabled boolean default null,
  p_in_app_sound_enabled boolean default null
)
returns table (
  push_enabled boolean,
  in_app_sound_enabled boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_push_enabled is null and p_in_app_sound_enabled is null then
    raise exception 'at least one notification preference is required' using errcode = '22023';
  end if;

  insert into public.notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  update public.notification_preferences p
  set push_enabled = coalesce(p_push_enabled, p.push_enabled),
      in_app_sound_enabled = coalesce(p_in_app_sound_enabled, p.in_app_sound_enabled),
      updated_at = now()
  where p.user_id = v_user_id;

  return query
  select p.push_enabled, p.in_app_sound_enabled
  from public.notification_preferences p
  where p.user_id = v_user_id;
end;
$function$;

revoke all on function private.get_notification_preferences() from public, anon;
revoke all on function private.update_notification_preferences(boolean, boolean) from public, anon;
grant execute on function private.get_notification_preferences() to authenticated, service_role;
grant execute on function private.update_notification_preferences(boolean, boolean) to authenticated, service_role;

create or replace function public.get_notification_preferences()
returns table (
  push_enabled boolean,
  in_app_sound_enabled boolean
)
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select * from private.get_notification_preferences();
$wrapper$;

create or replace function public.update_notification_preferences(
  p_push_enabled boolean default null,
  p_in_app_sound_enabled boolean default null
)
returns table (
  push_enabled boolean,
  in_app_sound_enabled boolean
)
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select * from private.update_notification_preferences($1, $2);
$wrapper$;

revoke all on function public.get_notification_preferences() from public, anon;
revoke all on function public.update_notification_preferences(boolean, boolean) from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.update_notification_preferences(boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Subscription hardening and per-device delivery attempts
-- ---------------------------------------------------------------------------

alter table public.web_push_subscriptions
  add column if not exists last_success_at timestamptz,
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_failure_code text,
  add column if not exists revoked_at timestamptz;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.web_push_subscriptions'::regclass
      and conname = 'web_push_subscriptions_failure_count_check'
  ) then
    alter table public.web_push_subscriptions
      add constraint web_push_subscriptions_failure_count_check
      check (failure_count between 0 and 20);
  end if;
end
$migration$;

drop policy if exists users_manage_own_web_push_subscriptions on public.web_push_subscriptions;
create policy users_manage_own_web_push_subscriptions
  on public.web_push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.web_push_subscriptions from anon, authenticated;

alter table public.web_push_delivery_jobs
  drop constraint if exists web_push_delivery_jobs_status_check;
alter table public.web_push_delivery_jobs
  add constraint web_push_delivery_jobs_status_check
  check (status in ('pending', 'processing', 'delivered', 'partial', 'failed', 'abandoned'));

create table if not exists public.web_push_delivery_attempts (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.web_push_delivery_jobs(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed', 'abandoned')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, subscription_id)
);

create index if not exists web_push_delivery_attempts_claim_idx
  on public.web_push_delivery_attempts (available_at, id)
  where status in ('pending', 'failed');
create index if not exists web_push_delivery_attempts_job_idx
  on public.web_push_delivery_attempts (job_id, status, id);

alter table public.web_push_delivery_attempts enable row level security;
revoke all on table public.web_push_delivery_attempts from anon, authenticated;

drop trigger if exists web_push_delivery_attempts_updated_at on public.web_push_delivery_attempts;
create trigger web_push_delivery_attempts_updated_at
  before update on public.web_push_delivery_attempts
  for each row execute function public.set_updated_at();

-- The alert trigger is the only producer of delivery jobs. A disabled user
-- preference prevents new work, while already queued work is abandoned by the
-- claim boundary below.
create or replace function public.enqueue_web_push_for_alert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_job_id bigint;
begin
  if new.event_type is null then
    return new;
  end if;

  if not coalesce((
    select p.push_enabled
    from public.notification_preferences p
    where p.user_id = new.user_id
  ), true) then
    return new;
  end if;

  if not exists (
    select 1
    from public.web_push_subscriptions s
    where s.user_id = new.user_id
      and s.enabled
      and s.revoked_at is null
  ) then
    return new;
  end if;

  insert into public.web_push_delivery_jobs (alert_id, user_id)
  values (new.id, new.user_id)
  on conflict (alert_id) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select j.id into v_job_id
    from public.web_push_delivery_jobs j
    where j.alert_id = new.id;
  end if;

  insert into public.web_push_delivery_attempts (job_id, subscription_id)
  select v_job_id, s.id
  from public.web_push_subscriptions s
  where s.user_id = new.user_id
    and s.enabled
    and s.revoked_at is null
  on conflict (job_id, subscription_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.enqueue_web_push_for_alert() from public, anon, authenticated;

drop trigger if exists app_alerts_enqueue_web_push on public.app_alerts;
create trigger app_alerts_enqueue_web_push
  after insert on public.app_alerts
  for each row execute function public.enqueue_web_push_for_alert();

-- Prevent a browser from taking over an endpoint already registered to another
-- account. Re-registering the same endpoint for the same account is the
-- supported renewal path.
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
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_platform text := lower(trim(coalesce(p_platform, 'web')));
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_endpoint, ''))) not between 20 and 2048
     or trim(p_endpoint) !~ '^https://[^[:space:]]+$'
     or length(trim(coalesce(p_p256dh, ''))) not between 20 and 200
     or trim(p_p256dh) !~ '^[A-Za-z0-9_-]+$'
     or length(trim(coalesce(p_auth, ''))) not between 8 and 200
     or trim(p_auth) !~ '^[A-Za-z0-9_-]+$'
  then
    raise exception 'invalid push subscription' using errcode = '22023';
  end if;
  if v_platform not in ('web', 'web-pwa', 'android-pwa', 'ios-pwa') then
    raise exception 'invalid push platform' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.web_push_subscriptions s
    where s.endpoint = trim(p_endpoint)
      and s.user_id <> v_user_id
  ) then
    raise exception 'push subscription endpoint belongs to another account'
      using errcode = '42501';
  end if;

  insert into public.web_push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent, platform,
    enabled, last_seen_at, updated_at, revoked_at,
    failure_count, last_failure_at, last_failure_code
  ) values (
    v_user_id, trim(p_endpoint), trim(p_p256dh), trim(p_auth),
    left(trim(coalesce(p_user_agent, '')), 500), v_platform,
    true, now(), now(), null, 0, null, null
  )
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    platform = excluded.platform,
    enabled = true,
    last_seen_at = now(),
    updated_at = now(),
    revoked_at = null,
    failure_count = 0,
    last_failure_at = null,
    last_failure_code = null
  where public.web_push_subscriptions.user_id = v_user_id
  returning id into v_id;

  if v_id is null then
    raise exception 'push subscription endpoint belongs to another account'
      using errcode = '42501';
  end if;

  -- Backfill attempts for alerts queued before this device was registered.
  insert into public.web_push_delivery_attempts (job_id, subscription_id)
  select j.id, v_id
  from public.web_push_delivery_jobs j
  where j.user_id = v_user_id
    and j.status in ('pending', 'processing', 'failed')
  on conflict (job_id, subscription_id) do nothing;

  return v_id;
end;
$function$;

create or replace function private.disable_web_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_subscription_id uuid;
  v_job_id bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.web_push_subscriptions
  set enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where user_id = auth.uid()
    and endpoint = trim(coalesce(p_endpoint, ''))
  returning id into v_subscription_id;

  if v_subscription_id is not null then
    update public.web_push_delivery_attempts
    set status = 'abandoned',
        lease_token = null,
        lease_expires_at = null,
        last_error = 'subscription_disabled',
        updated_at = now()
    where subscription_id = v_subscription_id
      and status in ('pending', 'processing', 'failed');

    for v_job_id in
      select distinct a.job_id
      from public.web_push_delivery_attempts a
      where a.subscription_id = v_subscription_id
    loop
      perform public.refresh_web_push_delivery_job(v_job_id);
    end loop;
  end if;
end;
$function$;

create or replace function public.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default 'web'
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select private.register_web_push_subscription($1, $2, $3, $4, $5);
$wrapper$;

create or replace function public.disable_web_push_subscription(p_endpoint text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select private.disable_web_push_subscription($1);
$wrapper$;

comment on function public.register_web_push_subscription(text, text, text, text, text)
  is 'findit:20260805073000-authenticated-boundary';
comment on function public.disable_web_push_subscription(text)
  is 'findit:20260805073000-authenticated-boundary';

revoke all on function public.register_web_push_subscription(text, text, text, text, text) from public, anon;
revoke all on function public.disable_web_push_subscription(text) from public, anon;
grant execute on function public.register_web_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.disable_web_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durable service-only delivery worker boundary
-- ---------------------------------------------------------------------------

create or replace function public.refresh_web_push_delivery_job(p_job_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_total integer;
  v_delivered integer;
  v_failed integer;
  v_abandoned integer;
  v_active integer;
  v_status text;
  v_last_error text;
  v_available_at timestamptz;
begin
  select
    count(*)::integer,
    count(*) filter (where a.status = 'delivered')::integer,
    count(*) filter (where a.status = 'failed')::integer,
    count(*) filter (where a.status = 'abandoned')::integer,
    count(*) filter (where a.status in ('pending', 'processing'))::integer,
    max(a.last_error) filter (where a.last_error is not null),
    min(a.available_at) filter (where a.status = 'failed')
  into v_total, v_delivered, v_failed, v_abandoned, v_active, v_last_error, v_available_at
  from public.web_push_delivery_attempts a
  where a.job_id = p_job_id;

  v_status := case
    when v_total = 0 then 'abandoned'
    when v_delivered = v_total then 'delivered'
    when v_delivered > 0 and v_active = 0 then 'partial'
    when v_active > 0 then 'processing'
    when v_failed > 0 then 'failed'
    else 'abandoned'
  end;

  update public.web_push_delivery_jobs j
  set status = v_status,
      delivered_count = v_delivered,
      failed_count = v_failed + v_abandoned,
      available_at = coalesce(v_available_at, now()),
      locked_at = case when v_status = 'processing' then coalesce(j.locked_at, now()) else null end,
      last_error = v_last_error,
      updated_at = now()
  where j.id = p_job_id;
end;
$function$;

create or replace function public.claim_web_push_delivery_attempts(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns table (
  attempt_id bigint,
  job_id bigint,
  alert_id uuid,
  user_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  title text,
  message text,
  link text,
  event_type text,
  source_key text,
  attempt_number integer,
  lease_token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_job_id bigint;
begin
  if auth.role() <> 'service_role'
     or p_limit not between 1 and 100
     or p_lease_seconds not between 30 and 600
  then
    raise exception 'invalid web push delivery claim' using errcode = '42501';
  end if;

  -- A crashed worker must not hold a device forever. Five attempts is the
  -- terminal boundary; the fifth expired lease becomes abandoned.
  update public.web_push_delivery_attempts a
  set status = case when a.attempts >= 5 then 'abandoned' else 'failed' end,
      available_at = now(),
      lease_token = null,
      lease_expires_at = null,
      last_error = coalesce(a.last_error, 'delivery_lease_expired'),
      updated_at = now()
  where a.status = 'processing'
    and a.lease_expires_at < now();

  update public.web_push_delivery_attempts a
  set status = 'abandoned',
      lease_token = null,
      lease_expires_at = null,
      last_error = case
        when not coalesce(p.push_enabled, true) then 'push_disabled'
        else 'subscription_disabled'
      end,
      updated_at = now()
  from public.web_push_subscriptions s
  left join public.notification_preferences p on p.user_id = s.user_id
  where a.subscription_id = s.id
    and a.status in ('pending', 'failed')
    and (not s.enabled or s.revoked_at is not null or not coalesce(p.push_enabled, true));

  -- Keep aggregate jobs truthful when a preference or device state abandons
  -- their final outstanding attempt without going through the worker's
  -- complete/fail callbacks.
  for v_job_id in
    select distinct a.job_id
    from public.web_push_delivery_attempts a
    where a.status = 'abandoned'
      and not exists (
        select 1
        from public.web_push_delivery_attempts active
        where active.job_id = a.job_id
          and active.status in ('pending', 'processing', 'failed')
      )
  loop
    perform public.refresh_web_push_delivery_job(v_job_id);
  end loop;

  return query
  with candidates as materialized (
    select a.id
    from public.web_push_delivery_attempts a
    join public.web_push_delivery_jobs j on j.id = a.job_id
    join public.web_push_subscriptions s on s.id = a.subscription_id
    left join public.notification_preferences p on p.user_id = s.user_id
    where a.status in ('pending', 'failed')
      and a.available_at <= now()
      and a.attempts < 5
      and j.status not in ('delivered', 'abandoned')
      and s.enabled
      and s.revoked_at is null
      and coalesce(p.push_enabled, true)
    order by a.available_at, a.id
    limit p_limit
    for update of a skip locked
  ), claimed as (
    update public.web_push_delivery_attempts a
    set status = 'processing',
        attempts = a.attempts + 1,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    from candidates c
    where a.id = c.id
    returning a.*
  ), touched_jobs as (
    update public.web_push_delivery_jobs j
    set status = 'processing', locked_at = now(), attempts = j.attempts + 1, updated_at = now()
    from claimed c
    where j.id = c.job_id
    returning j.id
  )
  select c.id, c.job_id, j.alert_id, j.user_id, s.id,
    s.endpoint, s.p256dh, s.auth,
    aa.title, aa.message, aa.link, aa.event_type, aa.source_key,
    c.attempts, c.lease_token
  from claimed c
  join public.web_push_delivery_jobs j on j.id = c.job_id
  join public.app_alerts aa on aa.id = j.alert_id
  join public.web_push_subscriptions s on s.id = c.subscription_id
  where exists (select 1 from touched_jobs tj where tj.id = c.job_id);
end;
$function$;

create or replace function public.complete_web_push_delivery_attempt(
  p_attempt_id bigint,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_job_id bigint;
  v_subscription_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.web_push_delivery_attempts a
  set status = 'delivered',
      delivered_at = now(),
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where a.id = p_attempt_id
    and a.status = 'processing'
    and a.lease_token = p_lease_token
  returning a.job_id, a.subscription_id into v_job_id, v_subscription_id;

  if v_job_id is null then
    return false;
  end if;

  update public.web_push_subscriptions
  set last_success_at = now(),
      failure_count = 0,
      last_failure_at = null,
      last_failure_code = null,
      updated_at = now()
  where id = v_subscription_id;

  perform public.refresh_web_push_delivery_job(v_job_id);
  return true;
end;
$function$;

create or replace function public.fail_web_push_delivery_attempt(
  p_attempt_id bigint,
  p_lease_token uuid,
  p_error_code text,
  p_retryable boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_job_id bigint;
  v_subscription_id uuid;
  v_attempts integer;
  v_error text := left(trim(coalesce(p_error_code, 'delivery_failed')), 120);
begin
  if auth.role() <> 'service_role'
     or length(v_error) not between 1 and 120
  then
    raise exception 'invalid web push delivery failure' using errcode = '42501';
  end if;

  update public.web_push_delivery_attempts a
  set status = case when p_retryable and a.attempts < 5 then 'failed' else 'abandoned' end,
      available_at = case
        when p_retryable and a.attempts < 5
          then now() + make_interval(secs => least(3600, (30 * power(2::numeric, greatest(a.attempts - 1, 0)))::integer))
        else now()
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error = v_error,
      updated_at = now()
  where a.id = p_attempt_id
    and a.status = 'processing'
    and a.lease_token = p_lease_token
  returning a.job_id, a.subscription_id, a.attempts into v_job_id, v_subscription_id, v_attempts;

  if v_job_id is null then
    return false;
  end if;

  update public.web_push_subscriptions
  set failure_count = least(20, failure_count + 1),
      last_failure_at = now(),
      last_failure_code = v_error,
      updated_at = now()
  where id = v_subscription_id;

  perform public.refresh_web_push_delivery_job(v_job_id);
  return true;
end;
$function$;

create or replace function public.retire_web_push_subscription(
  p_subscription_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_changed boolean := false;
  v_reason text := left(trim(coalesce(p_reason, 'invalid_subscription')), 120);
  v_job_id bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.web_push_subscriptions
  set enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      failure_count = least(20, failure_count + 1),
      last_failure_at = now(),
      last_failure_code = v_reason,
      updated_at = now()
  where id = p_subscription_id
  returning true into v_changed;

  if not coalesce(v_changed, false) then
    return false;
  end if;

  update public.web_push_delivery_attempts
  set status = 'abandoned',
      lease_token = null,
      lease_expires_at = null,
      last_error = v_reason,
      updated_at = now()
  where subscription_id = p_subscription_id
    and status in ('pending', 'processing', 'failed');

  for v_job_id in
    select distinct a.job_id
    from public.web_push_delivery_attempts a
    where a.subscription_id = p_subscription_id
  loop
    perform public.refresh_web_push_delivery_job(v_job_id);
  end loop;
  return true;
end;
$function$;

revoke all on function public.refresh_web_push_delivery_job(bigint) from public, anon, authenticated;
revoke all on function public.claim_web_push_delivery_attempts(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_web_push_delivery_attempt(bigint, uuid) from public, anon, authenticated;
revoke all on function public.fail_web_push_delivery_attempt(bigint, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.retire_web_push_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.refresh_web_push_delivery_job(bigint) to service_role;
grant execute on function public.claim_web_push_delivery_attempts(integer, integer) to service_role;
grant execute on function public.complete_web_push_delivery_attempt(bigint, uuid) to service_role;
grant execute on function public.fail_web_push_delivery_attempt(bigint, uuid, text, boolean) to service_role;
grant execute on function public.retire_web_push_subscription(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Canonical message notifications
-- ---------------------------------------------------------------------------

alter table public.app_alerts
  drop constraint if exists app_alerts_v1_event_type_check;
alter table public.app_alerts
  add constraint app_alerts_v1_event_type_check
  check (
    event_type is null
    or event_type in (
      'listing_approved', 'listing_rejected', 'listing_expires_soon',
      'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
      'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
      'peek_request_created', 'peek_request_answered',
      'business_application_updated', 'business_category_updated',
      'managed_listing_updated', 'message_received'
    )
  );

create or replace function public.create_essential_notification(
  p_user_id uuid,
  p_event_type text,
  p_source_key text,
  p_title text,
  p_message text,
  p_link text default null,
  p_listing_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  alert_id uuid;
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  normalized_source text := trim(coalesce(p_source_key, ''));
begin
  if p_event_type not in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'peek_request_created', 'peek_request_answered',
    'business_application_updated', 'business_category_updated',
    'managed_listing_updated', 'message_received'
  ) then
    raise exception 'unsupported notification event' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'notification recipient not found' using errcode = 'P0002';
  end if;
  if length(normalized_source) not between 1 and 200
    or length(normalized_title) not between 1 and 120
    or length(normalized_message) not between 1 and 1000
    or not public.is_safe_notification_link(p_link)
  then
    raise exception 'notification payload is invalid' using errcode = '22023';
  end if;
  if p_listing_id is not null and not exists (select 1 from public.listings where id = p_listing_id) then
    raise exception 'notification listing not found' using errcode = 'P0002';
  end if;

  insert into public.app_alerts (
    user_id, title, message, type, link, listing_id, event_type, source_key
  ) values (
    p_user_id, normalized_title, normalized_message,
    case when p_event_type = 'account_status' then 'system'::alert_type else 'status_change'::alert_type end,
    p_link, p_listing_id, p_event_type, normalized_source
  )
  on conflict (user_id, event_type, source_key)
    where event_type is not null and source_key is not null
  do nothing
  returning id into alert_id;

  if alert_id is null then
    select id into alert_id from public.app_alerts
    where user_id = p_user_id and event_type = p_event_type and source_key = normalized_source;
  end if;
  return alert_id;
end;
$function$;

revoke all on function public.create_essential_notification(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.notify_new_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_recipient uuid;
begin
  v_recipient := case
    when new.sender_id = new.buyer_id then new.seller_id
    when new.sender_id = new.seller_id then new.buyer_id
    else null
  end;

  if v_recipient is null or v_recipient = new.sender_id then
    return new;
  end if;

  perform public.create_essential_notification(
    v_recipient,
    'message_received',
    'message:' || new.id::text,
    'New message',
    'You have a new message in PeekaListing.',
    '/chats/' || new.conversation_id::text,
    new.listing_id
  );
  return new;
end;
$function$;

revoke all on function public.notify_new_inquiry() from public, anon, authenticated;
drop trigger if exists inquiries_notify_recipient on public.inquiries;
create trigger inquiries_notify_recipient
  after insert on public.inquiries
  for each row execute function public.notify_new_inquiry();

-- The keyset RPC is the current notification-center contract. Include every
-- event the canonical producer can emit, including message delivery.
create or replace function private.notification_rows_page(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'peek_request_created', 'peek_request_answered',
    'business_application_updated', 'business_category_updated',
    'managed_listing_updated', 'message_received'
  ) or p_limit not between 1 and 50
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid notification page' using errcode = '22023';
  end if;

  return query
  select a.id, a.event_type, a.title, a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read, a.read_at, a.listing_id, a.created_at
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type is not null
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
    and (p_cursor_at is null or (a.created_at, a.id) < (p_cursor_at, p_cursor_id))
  order by a.created_at desc, a.id desc
  limit p_limit + 1;
end;
$function$;

create or replace function public.notification_rows_page(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $wrapper$
  select * from private.notification_rows_page($1, $2, $3, $4, $5);
$wrapper$;

comment on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer)
  is 'findit:0101-authenticated-boundary';

revoke all on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer) from public, anon;
grant execute on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer) to authenticated;

commit;
