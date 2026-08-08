-- 20260808070000_abuse_rate_limit_buckets.sql
-- Shared database-backed abuse budgets for mutation surfaces that can be hit
-- concurrently from many application instances. The ledger stores only a
-- SHA-256 subject digest and one compact row per scope/subject, not raw request
-- events, IP addresses, email addresses, message bodies, or media metadata.

begin;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.abuse_rate_limit_buckets (
  scope text not null
    check (scope ~ '^[a-z][a-z0-9_.:-]{1,79}$'),
  subject_hash text not null
    check (subject_hash ~ '^[0-9a-f]{64}$'),
  tokens numeric(20,6) not null check (tokens >= 0),
  capacity integer not null check (capacity between 1 and 100000),
  refill_seconds integer not null check (refill_seconds between 1 and 604800),
  last_refill_at timestamptz not null,
  last_allowed_at timestamptz,
  last_denied_at timestamptz,
  denied_count bigint not null default 0 check (denied_count >= 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash),
  check (tokens <= capacity)
);

create index if not exists idx_abuse_rate_limit_buckets_expiry
  on private.abuse_rate_limit_buckets(expires_at, scope, subject_hash);

revoke all on table private.abuse_rate_limit_buckets
  from public, anon, authenticated, service_role;

create or replace function private.consume_abuse_rate_limit(
  p_scope text,
  p_subject text,
  p_capacity integer,
  p_refill_seconds integer,
  p_cost integer default 1
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_hash text;
  v_now timestamptz := clock_timestamp();
  v_row private.abuse_rate_limit_buckets%rowtype;
  v_elapsed_seconds numeric;
  v_scaled_tokens numeric;
  v_available numeric;
  v_retry numeric;
  v_expiry_seconds integer;
begin
  if v_scope !~ '^[a-z][a-z0-9_.:-]{1,79}$'
    or char_length(v_subject) not between 1 and 512
    or p_capacity not between 1 and 100000
    or p_refill_seconds not between 1 and 604800
    or p_cost not between 1 and p_capacity
  then
    raise exception 'invalid abuse rate limit configuration' using errcode = '22023';
  end if;

  v_hash := encode(
    extensions.digest(convert_to(v_subject, 'UTF8'), 'sha256'),
    'hex'
  );
  v_expiry_seconds := greatest(3600, least(1209600, p_refill_seconds * 2));

  -- The insert establishes exactly one shared row. A concurrent first writer
  -- either creates it or waits on the unique key; the FOR UPDATE below then
  -- serializes every token decision for that scope/subject across hosts.
  insert into private.abuse_rate_limit_buckets (
    scope, subject_hash, tokens, capacity, refill_seconds,
    last_refill_at, expires_at
  ) values (
    v_scope, v_hash, p_capacity, p_capacity, p_refill_seconds,
    v_now, v_now + make_interval(secs => v_expiry_seconds)
  )
  on conflict (scope, subject_hash) do nothing;

  select * into v_row
  from private.abuse_rate_limit_buckets b
  where b.scope = v_scope and b.subject_hash = v_hash
  for update;

  if not found then
    raise exception 'abuse rate limit state unavailable' using errcode = '40001';
  end if;

  v_elapsed_seconds := greatest(
    0::numeric,
    extract(epoch from (v_now - v_row.last_refill_at))
  );

  -- Preserve the filled fraction when a deployment changes a budget rather
  -- than granting a fresh burst merely because capacity changed.
  v_scaled_tokens := least(
    p_capacity::numeric,
    greatest(
      0::numeric,
      (v_row.tokens / greatest(v_row.capacity, 1)::numeric) * p_capacity::numeric
    )
  );
  v_available := least(
    p_capacity::numeric,
    v_scaled_tokens
      + (v_elapsed_seconds * p_capacity::numeric / p_refill_seconds::numeric)
  );

  if v_available >= p_cost then
    v_available := v_available - p_cost;
    update private.abuse_rate_limit_buckets
    set tokens = v_available,
        capacity = p_capacity,
        refill_seconds = p_refill_seconds,
        last_refill_at = v_now,
        last_allowed_at = v_now,
        expires_at = v_now + make_interval(secs => v_expiry_seconds)
    where scope = v_scope and subject_hash = v_hash;

    allowed := true;
    remaining := floor(v_available)::integer;
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  v_retry := ceil(
    ((p_cost::numeric - v_available) * p_refill_seconds::numeric)
      / p_capacity::numeric
  );
  update private.abuse_rate_limit_buckets
  set tokens = v_available,
      capacity = p_capacity,
      refill_seconds = p_refill_seconds,
      last_refill_at = v_now,
      last_denied_at = v_now,
      denied_count = denied_count + 1,
      expires_at = v_now + make_interval(secs => v_expiry_seconds)
  where scope = v_scope and subject_hash = v_hash;

  allowed := false;
  remaining := floor(v_available)::integer;
  retry_after_seconds := greatest(1, v_retry::integer);
  return next;
end;
$function$;

revoke all on function private.consume_abuse_rate_limit(text, text, integer, integer, integer)
  from public, anon, authenticated, service_role;

create or replace function private.require_abuse_rate_limit(
  p_scope text,
  p_subject text,
  p_capacity integer,
  p_refill_seconds integer,
  p_error_message text,
  p_error_code text default '42900',
  p_cost integer default 1
)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_result record;
begin
  if coalesce(p_error_code, '') !~ '^[0-9A-Z]{5}$'
    or char_length(btrim(coalesce(p_error_message, ''))) not between 1 and 240
  then
    raise exception 'invalid abuse rate limit error contract' using errcode = '22023';
  end if;

  select * into v_result
  from private.consume_abuse_rate_limit(
    p_scope, p_subject, p_capacity, p_refill_seconds, p_cost
  );

  if not coalesce(v_result.allowed, false) then
    raise exception '%', p_error_message
      using errcode = p_error_code,
            hint = format('Retry after %s seconds', greatest(1, coalesce(v_result.retry_after_seconds, 1)));
  end if;
end;
$function$;

revoke all on function private.require_abuse_rate_limit(text, text, integer, integer, text, text, integer)
  from public, anon, authenticated, service_role;

-- Messages: retain the existing rolling-query checks as a compatibility guard,
-- while this trigger closes concurrent races across application instances.
create or replace function private.enforce_inquiry_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.sender_id is not null then
    perform private.require_abuse_rate_limit(
      'message.minute', new.sender_id::text, 10, 60,
      'message rate limit exceeded; try again shortly', 'P0001'
    );
    perform private.require_abuse_rate_limit(
      'message.day', new.sender_id::text, 200, 86400,
      'daily message rate limit exceeded', 'P0001'
    );
  end if;
  return new;
end;
$function$;

-- Support requests can be anonymous. Hashing happens before persistence in the
-- private bucket store, so the limiter never becomes a second email database.
create or replace function private.enforce_support_request_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_email text := lower(btrim(new.contact_email));
begin
  perform private.require_abuse_rate_limit(
    'support.email.15m', 'email:' || v_email, 3, 900,
    'support request rate limit exceeded; try again later', 'P0001'
  );
  perform private.require_abuse_rate_limit(
    'support.email.day', 'email:' || v_email, 10, 86400,
    'daily support request limit exceeded', 'P0001'
  );
  if new.user_id is not null then
    perform private.require_abuse_rate_limit(
      'support.user.day', 'user:' || new.user_id::text, 10, 86400,
      'daily support request limit exceeded', 'P0001'
    );
  end if;
  return new;
end;
$function$;

create or replace function private.enforce_listing_upload_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'upload.listing_image.hour', new.user_id::text, 60, 3600,
    'listing image upload rate exceeded', 'P0001'
  );
  return new;
end;
$function$;

create or replace function private.enforce_marketplace_upload_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'upload.marketplace_image.hour', new.user_id::text, 40, 3600,
    'marketplace image upload rate exceeded', 'P0001'
  );
  return new;
end;
$function$;

create or replace function private.enforce_tour_upload_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'upload.peek_video.hour', new.user_id::text, 10, 3600,
    'Tour upload rate exceeded', 'P0001'
  );
  return new;
end;
$function$;

create or replace function private.enforce_contact_reveal_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'contact_reveal.day', new.user_id::text, 40, 86400,
    'contact reveal limit reached, try again later', '54000'
  );
  return new;
end;
$function$;

create or replace function private.enforce_peek_request_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'peek_request.category.30m',
    new.requester_id::text || ':' || new.category::text,
    3, 1800,
    'too many recent Peek Requests in this category', '42900'
  );
  return new;
end;
$function$;

create or replace function private.enforce_report_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.reporter_id is null then return new; end if;
  if new.tour_id is not null then
    perform private.require_abuse_rate_limit(
      'report.peek.day', new.reporter_id::text, 10, 86400,
      'Tour report rate exceeded', 'P0001'
    );
  else
    perform private.require_abuse_rate_limit(
      'report.general.day', new.reporter_id::text, 20, 86400,
      'report rate limit exceeded; try again later', '42900'
    );
  end if;
  return new;
end;
$function$;

create or replace function private.enforce_business_application_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'business_application.day', new.user_id::text, 5, 86400,
    'business application rate limit exceeded; try again later', '42900'
  );
  return new;
end;
$function$;

create or replace function private.enforce_managed_listing_request_abuse_budget()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.require_abuse_rate_limit(
    'managed_listing_request.day', new.requester_user_id::text, 20, 86400,
    'managed listing request rate limit exceeded; try again later', '42900'
  );
  return new;
end;
$function$;

revoke all on function private.enforce_inquiry_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_support_request_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_listing_upload_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_marketplace_upload_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_tour_upload_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_contact_reveal_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_peek_request_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_report_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_business_application_abuse_budget() from public, anon, authenticated, service_role;
revoke all on function private.enforce_managed_listing_request_abuse_budget() from public, anon, authenticated, service_role;

drop trigger if exists trg_inquiries_abuse_budget on public.inquiries;
create trigger trg_inquiries_abuse_budget
  before insert on public.inquiries
  for each row execute function private.enforce_inquiry_abuse_budget();

drop trigger if exists trg_support_requests_abuse_budget on public.support_requests;
create trigger trg_support_requests_abuse_budget
  before insert on public.support_requests
  for each row execute function private.enforce_support_request_abuse_budget();

drop trigger if exists trg_listing_upload_intents_abuse_budget on public.listing_upload_intents;
create trigger trg_listing_upload_intents_abuse_budget
  before insert on public.listing_upload_intents
  for each row execute function private.enforce_listing_upload_abuse_budget();

drop trigger if exists trg_marketplace_image_upload_intents_abuse_budget on public.marketplace_image_upload_intents;
create trigger trg_marketplace_image_upload_intents_abuse_budget
  before insert on public.marketplace_image_upload_intents
  for each row execute function private.enforce_marketplace_upload_abuse_budget();

drop trigger if exists trg_listing_tour_upload_intents_abuse_budget on public.listing_tour_upload_intents;
create trigger trg_listing_tour_upload_intents_abuse_budget
  before insert on public.listing_tour_upload_intents
  for each row execute function private.enforce_tour_upload_abuse_budget();

drop trigger if exists trg_contact_reveal_events_abuse_budget on public.contact_reveal_events;
create trigger trg_contact_reveal_events_abuse_budget
  before insert on public.contact_reveal_events
  for each row execute function private.enforce_contact_reveal_abuse_budget();

drop trigger if exists trg_peek_requests_abuse_budget on public.peek_requests;
create trigger trg_peek_requests_abuse_budget
  before insert on public.peek_requests
  for each row execute function private.enforce_peek_request_abuse_budget();

drop trigger if exists trg_reports_abuse_budget on public.reports;
create trigger trg_reports_abuse_budget
  before insert on public.reports
  for each row execute function private.enforce_report_abuse_budget();

drop trigger if exists trg_business_applications_abuse_budget on public.business_applications;
create trigger trg_business_applications_abuse_budget
  before insert on public.business_applications
  for each row execute function private.enforce_business_application_abuse_budget();

drop trigger if exists trg_managed_listing_requests_abuse_budget on public.managed_listing_requests;
create trigger trg_managed_listing_requests_abuse_budget
  before insert on public.managed_listing_requests
  for each row execute function private.enforce_managed_listing_request_abuse_budget();

-- Bounded maintenance primitive. The token ledger is one row per active
-- scope/subject, and expired rows can be removed in small SKIP LOCKED batches.
create or replace function public.prune_abuse_rate_limit_buckets(
  p_limit integer default 5000
)
returns integer
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_deleted integer := 0;
begin
  if auth.role() <> 'service_role' and session_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50000 then
    raise exception 'invalid prune limit' using errcode = '22023';
  end if;

  with doomed as (
    select b.scope, b.subject_hash
    from private.abuse_rate_limit_buckets b
    where b.expires_at < clock_timestamp()
    order by b.expires_at, b.scope, b.subject_hash
    limit p_limit
    for update skip locked
  )
  delete from private.abuse_rate_limit_buckets b
  using doomed d
  where b.scope = d.scope and b.subject_hash = d.subject_hash;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.prune_abuse_rate_limit_buckets(integer)
  from public, anon, authenticated;
grant execute on function public.prune_abuse_rate_limit_buckets(integer)
  to service_role;

commit;
