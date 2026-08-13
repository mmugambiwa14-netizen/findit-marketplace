begin;

-- ---------------------------------------------------------------------------
-- Missing foreign-key and worker hot-path indexes
-- ---------------------------------------------------------------------------

create index if not exists web_push_delivery_jobs_user_status_idx
  on public.web_push_delivery_jobs (user_id, status, available_at, id);
create index if not exists web_push_delivery_attempts_subscription_idx
  on public.web_push_delivery_attempts (subscription_id, status, id);

create index if not exists business_category_approvals_application_idx
  on public.business_category_approvals (business_application_id, created_at desc);
create index if not exists business_category_approvals_approved_by_idx
  on public.business_category_approvals (approved_by);
create index if not exists managed_listing_requests_requester_idx
  on public.managed_listing_requests (requester_user_id, created_at desc);
create index if not exists managed_listing_requests_assigned_to_idx
  on public.managed_listing_requests (assigned_to);
create index if not exists business_application_responses_application_idx
  on public.business_application_responses (application_id, created_at desc);
create index if not exists business_application_responses_user_idx
  on public.business_application_responses (user_id, created_at desc);
create index if not exists business_review_events_application_idx
  on public.business_review_events (application_id, created_at desc);
create index if not exists business_review_events_category_approval_idx
  on public.business_review_events (category_approval_id, created_at desc);
create index if not exists business_review_events_actor_user_idx
  on public.business_review_events (actor_user_id, created_at desc);
create index if not exists contact_reveal_events_listing_idx
  on public.contact_reveal_events (listing_id, revealed_at desc);
create index if not exists contact_reveal_events_service_idx
  on public.contact_reveal_events (service_id, revealed_at desc);
create index if not exists peek_requests_current_response_idx
  on public.peek_requests (current_response_id);
create index if not exists peek_requests_merged_into_idx
  on public.peek_requests (merged_into_id);
create index if not exists peek_response_binding_intents_request_idx
  on public.peek_response_binding_intents (request_id);
create index if not exists peek_response_binding_intents_owner_idx
  on public.peek_response_binding_intents (owner_id);
create index if not exists saved_services_service_idx
  on public.saved_services (service_id);

-- Public service search uses the description branch as well as title/location.
-- pg_trgm was moved to the extensions schema in 0082.
create index if not exists idx_services_description_trgm
  on public.services using gin (description extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Email notification preferences and durable delivery jobs
--
-- The UUID/next_attempt_at schema below is the canonical email contract used
-- by transactional-email-dispatch.  The IF NOT EXISTS/ADD COLUMN guards also
-- converge environments that already received the earlier email migration.
-- ---------------------------------------------------------------------------

create table if not exists public.email_notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default true,
  messages boolean not null default true,
  peek_activity boolean not null default true,
  listing_activity boolean not null default true,
  moderation boolean not null default true,
  product_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_notification_preferences
  add column if not exists enabled boolean not null default true,
  add column if not exists messages boolean not null default true,
  add column if not exists peek_activity boolean not null default true,
  add column if not exists listing_activity boolean not null default true,
  add column if not exists moderation boolean not null default true,
  add column if not exists product_updates boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.email_notification_preferences enable row level security;
revoke all on table public.email_notification_preferences from anon, authenticated;
grant select, insert, update on table public.email_notification_preferences to authenticated;

drop policy if exists email_notification_preferences_owner_access
  on public.email_notification_preferences;
drop policy if exists email_preferences_owner_insert
  on public.email_notification_preferences;
drop policy if exists email_preferences_owner_select
  on public.email_notification_preferences;
drop policy if exists email_preferences_owner_update
  on public.email_notification_preferences;
create policy email_notification_preferences_owner_access
  on public.email_notification_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists email_notification_preferences_updated_at
  on public.email_notification_preferences;
create trigger email_notification_preferences_updated_at
  before update on public.email_notification_preferences
  for each row execute function public.set_updated_at();

-- Existing hosted deployments used a composite-table return type.  Drop the
-- old signatures before replacing them with the stable frontend projection.
drop function if exists public.get_email_notification_preferences();
drop function if exists public.update_email_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean
);

create function public.get_email_notification_preferences()
returns table (
  enabled boolean,
  messages boolean,
  peek_activity boolean,
  listing_activity boolean,
  moderation boolean,
  product_updates boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  insert into public.email_notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return query
  select p.enabled, p.messages, p.peek_activity, p.listing_activity,
    p.moderation, p.product_updates, p.updated_at
  from public.email_notification_preferences p
  where p.user_id = v_user_id;
end;
$function$;

create function public.update_email_notification_preferences(
  p_enabled boolean default null,
  p_messages boolean default null,
  p_peek_activity boolean default null,
  p_listing_activity boolean default null,
  p_moderation boolean default null,
  p_product_updates boolean default null
)
returns table (
  enabled boolean,
  messages boolean,
  peek_activity boolean,
  listing_activity boolean,
  moderation boolean,
  product_updates boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_enabled is null and p_messages is null and p_peek_activity is null
     and p_listing_activity is null and p_moderation is null
     and p_product_updates is null then
    raise exception 'at least one email preference is required' using errcode = '22023';
  end if;

  insert into public.email_notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  update public.email_notification_preferences p
  set enabled = coalesce(p_enabled, p.enabled),
      messages = coalesce(p_messages, p.messages),
      peek_activity = coalesce(p_peek_activity, p.peek_activity),
      listing_activity = coalesce(p_listing_activity, p.listing_activity),
      moderation = coalesce(p_moderation, p.moderation),
      product_updates = coalesce(p_product_updates, p.product_updates),
      updated_at = now()
  where p.user_id = v_user_id;

  return query
  select p.enabled, p.messages, p.peek_activity, p.listing_activity,
    p.moderation, p.product_updates, p.updated_at
  from public.email_notification_preferences p
  where p.user_id = v_user_id;
end;
$function$;

revoke all on function public.get_email_notification_preferences()
  from public, anon;
revoke all on function public.update_email_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean)
  from public, anon;
grant execute on function public.get_email_notification_preferences() to authenticated;
grant execute on function public.update_email_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean)
  to authenticated;

create or replace function private.email_event_enabled(p_user_id uuid, p_event_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_event_type = 'account_status' then true
    when not coalesce(p.enabled, true) then false
    when p_event_type in (
      'message_received', 'new_message', 'conversation_message',
      'listing_enquiry', 'service_enquiry'
    ) then coalesce(p.messages, true)
    when p_event_type in (
      'peek_request_created', 'peek_request_answered', 'peek_response_ready',
      'tour_ready', 'tour_failed', 'tour_rejected'
    ) then coalesce(p.peek_activity, true)
    when p_event_type in (
      'listing_approved', 'listing_expires_soon', 'listing_status_changed',
      'saved_listing_unavailable'
    ) then coalesce(p.listing_activity, true)
    when p_event_type in (
      'listing_rejected', 'moderation_decision', 'listing_removed',
      'service_removed', 'account_restricted', 'appeal_decided',
      'report_resolved', 'business_application_updated',
      'business_category_updated', 'managed_listing_updated'
    ) then coalesce(p.moderation, true)
    else coalesce(p.product_updates, false)
  end
  from (
    select
      (select e.enabled from public.email_notification_preferences e where e.user_id = p_user_id) as enabled,
      (select e.messages from public.email_notification_preferences e where e.user_id = p_user_id) as messages,
      (select e.peek_activity from public.email_notification_preferences e where e.user_id = p_user_id) as peek_activity,
      (select e.listing_activity from public.email_notification_preferences e where e.user_id = p_user_id) as listing_activity,
      (select e.moderation from public.email_notification_preferences e where e.user_id = p_user_id) as moderation,
      (select e.product_updates from public.email_notification_preferences e where e.user_id = p_user_id) as product_updates
  ) p;
$function$;

revoke all on function private.email_event_enabled(uuid, text)
  from public, anon, authenticated;

create table if not exists public.email_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null unique references public.app_alerts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  message text not null,
  link text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'retry', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.email_delivery_jobs
  add column if not exists alert_id uuid,
  add column if not exists user_id uuid,
  add column if not exists event_type text,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists link text,
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists sent_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists email_delivery_jobs_ready_idx
  on public.email_delivery_jobs (next_attempt_at, created_at)
  where status in ('pending', 'retry');
create index if not exists email_delivery_jobs_claim_idx
  on public.email_delivery_jobs (next_attempt_at, id)
  where status in ('pending', 'retry');
create index if not exists email_delivery_jobs_user_created_idx
  on public.email_delivery_jobs (user_id, created_at desc);

alter table public.email_delivery_jobs enable row level security;
revoke all on table public.email_delivery_jobs from public, anon, authenticated;

drop trigger if exists email_delivery_jobs_updated_at on public.email_delivery_jobs;
create trigger email_delivery_jobs_updated_at
  before update on public.email_delivery_jobs
  for each row execute function public.set_updated_at();

create or replace function public.enqueue_email_for_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.event_type is null
     or not private.email_event_enabled(new.user_id, new.event_type) then
    return new;
  end if;

  insert into public.email_delivery_jobs (
    alert_id, user_id, event_type, title, message, link
  ) values (
    new.id, new.user_id, new.event_type, new.title, new.message, new.link
  )
  on conflict (alert_id) do nothing;
  return new;
end;
$function$;

revoke all on function public.enqueue_email_for_alert() from public, anon, authenticated;
drop trigger if exists app_alerts_enqueue_email on public.app_alerts;
create trigger app_alerts_enqueue_email
  after insert on public.app_alerts
  for each row execute function public.enqueue_email_for_alert();

drop function if exists public.claim_email_delivery_jobs(integer, integer);
drop function if exists public.complete_email_delivery_job(uuid, uuid, text);
drop function if exists public.complete_email_delivery_job(bigint, uuid, text);
drop function if exists public.fail_email_delivery_job(uuid, uuid, text, boolean);
drop function if exists public.fail_email_delivery_job(bigint, uuid, text, boolean);

create function public.claim_email_delivery_jobs(
  p_limit integer default 25,
  p_lease_seconds integer default 180
)
returns table (
  job_id uuid,
  claim_token uuid,
  user_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() <> 'service_role'
     or p_limit not between 1 and 100
     or p_lease_seconds not between 30 and 600 then
    raise exception 'invalid email delivery claim' using errcode = '42501';
  end if;

  update public.email_delivery_jobs j
  set status = case when j.attempt_count >= 8 then 'failed' else 'retry' end,
      next_attempt_at = now(),
      claim_token = null,
      claimed_at = null,
      last_error = coalesce(j.last_error, 'delivery_lease_expired'),
      updated_at = now()
  where j.status = 'processing'
    and j.claimed_at is not null
    and j.claimed_at < now() - make_interval(secs => p_lease_seconds);

  return query
  with candidates as materialized (
    select j.id
    from public.email_delivery_jobs j
    where j.status in ('pending', 'retry')
      and j.next_attempt_at <= now()
      and j.attempt_count < 8
    order by j.next_attempt_at, j.created_at, j.id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.email_delivery_jobs j
    set status = 'processing',
        attempt_count = j.attempt_count + 1,
        claim_token = gen_random_uuid(),
        claimed_at = now(),
        updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.id, j.claim_token, j.user_id, j.event_type, j.title,
      j.message, j.link, j.attempt_count
  )
  select c.id, c.claim_token, c.user_id, c.event_type, c.title,
    c.message, c.link, c.attempt_count
  from claimed c;
end;
$function$;

create function public.complete_email_delivery_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.email_delivery_jobs j
  set status = 'sent',
      claim_token = null,
      claimed_at = null,
      provider_message_id = left(nullif(trim(p_provider_message_id), ''), 255),
      last_error = null,
      sent_at = now(),
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'processing'
    and j.claim_token = p_claim_token;
  return found;
end;
$function$;

create function public.fail_email_delivery_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retryable boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_error text := left(trim(coalesce(p_error, 'email_delivery_failed')), 1000);
begin
  if auth.role() <> 'service_role' or length(v_error) not between 1 and 1000 then
    raise exception 'invalid email delivery failure' using errcode = '42501';
  end if;

  update public.email_delivery_jobs j
  set status = case when p_retryable and j.attempt_count < 8 then 'retry' else 'failed' end,
      next_attempt_at = case
        when p_retryable and j.attempt_count < 8
          then now() + make_interval(secs => least(21600, (30 * power(2::numeric, greatest(j.attempt_count - 1, 0)))::integer))
        else now()
      end,
      claim_token = null,
      claimed_at = null,
      last_error = v_error,
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'processing'
    and j.claim_token = p_claim_token;
  return found;
end;
$function$;

revoke all on function public.claim_email_delivery_jobs(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_email_delivery_job(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_email_delivery_job(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_email_delivery_jobs(integer, integer) to service_role;
grant execute on function public.complete_email_delivery_job(uuid, uuid, text) to service_role;
grant execute on function public.fail_email_delivery_job(uuid, uuid, text, boolean) to service_role;

-- This table is internal configuration consumed by trusted RPCs. The browser
-- has no source-level need to read its raw JSON configuration.
revoke select on public.marketplace_operational_controls from anon, authenticated;

commit;
