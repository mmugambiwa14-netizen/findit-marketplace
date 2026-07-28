-- 0040_v1_scale_hardening_and_observability.sql
-- Final Tours release hardening: bounded keyset messaging, compact operational
-- metrics, deterministic alert evaluation, and founder-only health reporting.
-- The design avoids unbounded raw telemetry and exact-count browse queries.

-- ---------------------------------------------------------------------------
-- Messaging scale boundary
-- ---------------------------------------------------------------------------

create index if not exists idx_inquiries_conversation_cursor
  on public.inquiries(conversation_id, created_at desc, id desc);

create index if not exists idx_conversations_retention_cleanup
  on public.conversations(retention_until, id)
  where state = 'closed';

create index if not exists idx_listing_tours_public_feed_cursor
  on public.listing_tours(published_at desc, id desc)
  where status = 'ready'
    and moderation_status = 'approved'
    and deleted_at is null
    and removed_at is null
    and published_at is not null
    and thumbnail_storage_path is not null
    and playback_storage_path is not null;

create or replace function public.message_inbox_page(
  p_query text default '',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns table (
  conversation_id uuid,
  listing_id uuid,
  listing_kind text,
  listing_title text,
  listing_photo text,
  listing_price numeric,
  listing_currency text,
  listing_status text,
  has_tour boolean,
  tour_duration_seconds numeric,
  other_user_id uuid,
  other_user_name text,
  last_message text,
  last_message_at timestamptz,
  has_unread boolean,
  is_blocked boolean,
  state text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50
    or char_length(normalized_query) > 100
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid inbox page request' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with rows as (
    select
      c.id as row_conversation_id,
      c.listing_id as row_listing_id,
      l.kind::text as row_listing_kind,
      l.title as row_listing_title,
      l.photos ->> 0 as row_listing_photo,
      l.price as row_listing_price,
      l.currency as row_listing_currency,
      l.status::text as row_listing_status,
      eligible_tour.tour_id is not null as row_has_tour,
      eligible_tour.duration_seconds as row_tour_duration_seconds,
      other_user.id as row_other_user_id,
      coalesce(other_user.full_name, 'FindIt user') as row_other_user_name,
      latest.message as row_last_message,
      coalesce(c.last_message_at, c.created_at) as row_last_message_at,
      c.last_message_sender_id <> auth.uid()
        and coalesce(c.last_message_at, c.created_at) > coalesce(
          case when c.buyer_id = auth.uid() then c.buyer_last_seen_at else c.seller_last_seen_at end,
          '-infinity'::timestamptz
        ) as row_unread,
      (c.buyer_blocked_at is not null or c.seller_blocked_at is not null) as row_blocked,
      c.state as row_state
    from public.conversations c
    join public.listings l on l.id = c.listing_id
    join public.users other_user on other_user.id = case
      when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
    left join lateral (
      select i.message
      from public.inquiries i
      where i.conversation_id = c.id
      order by i.created_at desc, i.id desc
      limit 1
    ) latest on true
    left join lateral (
      select t.id as tour_id, t.duration_seconds
      from public.listing_tour_slots slot
      join public.listing_tours t on t.id = slot.current_tour_id
      where slot.listing_id = l.id and public.is_tour_public_eligible(t.id)
      limit 1
    ) eligible_tour on true
    where c.buyer_id = auth.uid() or c.seller_id = auth.uid()
  ), filtered as (
    select *
    from rows
    where (not p_unread_only or row_unread)
      and (
        normalized_query = ''
        or row_listing_title ilike '%' || escaped_query || '%' escape E'\\'
        or row_other_user_name ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (
        p_cursor_at is null
        or (row_last_message_at, row_conversation_id) < (p_cursor_at, p_cursor_id)
      )
  )
  select
    row_conversation_id,
    row_listing_id,
    row_listing_kind,
    row_listing_title,
    row_listing_photo,
    row_listing_price,
    row_listing_currency,
    row_listing_status,
    row_has_tour,
    row_tour_duration_seconds,
    row_other_user_id,
    row_other_user_name,
    row_last_message,
    row_last_message_at,
    row_unread,
    row_blocked,
    row_state
  from filtered
  order by row_last_message_at desc, row_conversation_id desc
  limit p_limit + 1;
end;
$$;

create or replace function public.message_thread_page(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50
    or ((p_before_created_at is null) <> (p_before_id is null))
  then
    raise exception 'invalid thread page request' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  ) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;

  return query
  select i.id, i.sender_id, i.message, i.created_at
  from public.inquiries i
  where i.conversation_id = p_conversation_id
    and (
      p_before_created_at is null
      or (i.created_at, i.id) < (p_before_created_at, p_before_id)
    )
  order by i.created_at desc, i.id desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.message_inbox_page(text, boolean, timestamptz, uuid, integer) from public, anon;
revoke all on function public.message_thread_page(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.message_inbox_page(text, boolean, timestamptz, uuid, integer) to authenticated;
grant execute on function public.message_thread_page(uuid, timestamptz, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Bounded operational telemetry
-- ---------------------------------------------------------------------------

create table public.operational_metric_buckets (
  bucket_start timestamptz not null,
  metric_name text not null check (metric_name ~ '^[a-z][a-z0-9_]{1,79}$'),
  dimension text not null default 'all' check (dimension ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  sample_count bigint not null default 0 check (sample_count >= 0),
  value_sum numeric not null default 0,
  value_max numeric,
  last_value numeric,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  first_recorded_at timestamptz not null default now(),
  last_recorded_at timestamptz not null default now(),
  primary key (bucket_start, metric_name, dimension)
);

create index idx_operational_metric_name_time
  on public.operational_metric_buckets(metric_name, bucket_start desc);

create table public.operational_alerts (
  alert_key text primary key check (alert_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  severity text not null check (severity in ('warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  observed_value numeric not null,
  threshold_value numeric not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint operational_alert_resolution check (
    (status = 'open' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index idx_operational_alerts_open
  on public.operational_alerts(severity, last_seen_at desc)
  where status = 'open';

alter table public.operational_metric_buckets enable row level security;
alter table public.operational_alerts enable row level security;
revoke all on table public.operational_metric_buckets from anon, authenticated;
revoke all on table public.operational_alerts from anon, authenticated;

create or replace function public.record_operational_metric_internal(
  p_metric_name text,
  p_value numeric default 1,
  p_dimension text default 'all',
  p_sample_count integer default 1,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := lower(trim(coalesce(p_metric_name, '')));
  normalized_dimension text := lower(trim(coalesce(p_dimension, 'all')));
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  hour_bucket timestamptz := date_trunc('hour', coalesce(p_occurred_at, now()));
begin
  if normalized_name !~ '^[a-z][a-z0-9_]{1,79}$'
    or normalized_dimension !~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'
    or p_value is null
    or p_sample_count not between 1 and 10000
    or jsonb_typeof(normalized_metadata) <> 'object'
    or octet_length(normalized_metadata::text) > 4096
    or hour_bucket < now() - interval '7 days'
    or hour_bucket > now() + interval '5 minutes'
  then
    raise exception 'invalid operational metric' using errcode = '22023';
  end if;

  insert into public.operational_metric_buckets (
    bucket_start, metric_name, dimension, sample_count, value_sum,
    value_max, last_value, metadata, first_recorded_at, last_recorded_at
  ) values (
    hour_bucket, normalized_name, normalized_dimension, p_sample_count,
    p_value * p_sample_count, p_value, p_value, normalized_metadata, now(), now()
  )
  on conflict (bucket_start, metric_name, dimension) do update set
    sample_count = public.operational_metric_buckets.sample_count + excluded.sample_count,
    value_sum = public.operational_metric_buckets.value_sum + excluded.value_sum,
    value_max = greatest(public.operational_metric_buckets.value_max, excluded.value_max),
    last_value = excluded.last_value,
    metadata = case
      when excluded.metadata = '{}'::jsonb then public.operational_metric_buckets.metadata
      else excluded.metadata
    end,
    last_recorded_at = now();
end;
$$;

create or replace function public.record_operational_metric(
  p_metric_name text,
  p_value numeric default 1,
  p_dimension text default 'all',
  p_sample_count integer default 1,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.record_operational_metric_internal(
    p_metric_name, p_value, p_dimension, p_sample_count, p_metadata, p_occurred_at
  );
end;
$$;

revoke all on function public.record_operational_metric_internal(text, numeric, text, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.record_operational_metric(text, numeric, text, integer, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.record_operational_metric(text, numeric, text, integer, jsonb, timestamptz) to service_role;

-- Message writes record compact server-side execution time. This does not store
-- message text, participant identity, IP addresses, or one raw row per message.
create or replace function public.start_listing_conversation(
  p_listing_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  started_at timestamptz := clock_timestamp();
  listing_row public.listings%rowtype;
  conversation_row public.conversations%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into listing_row from public.listings
   where id = p_listing_id and status in ('available', 'under_offer')
   for share;
  if not found then
    raise exception 'listing is unavailable' using errcode = 'P0002';
  end if;
  if listing_row.seller_id = auth.uid() then
    raise exception 'cannot message your own listing' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.users where id = listing_row.seller_id and status = 'active'
  ) then
    raise exception 'seller is unavailable' using errcode = 'P0002';
  end if;

  select full_name into buyer_name from public.users where id = auth.uid();

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (listing_row.id, auth.uid(), listing_row.seller_id)
  on conflict (listing_id, buyer_id) do update set updated_at = now()
  returning * into conversation_row;

  if conversation_row.state <> 'open'
    or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null
    or conversation_row.retention_until <= now()
  then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;

  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, listing_row.seller_id, auth.uid(), buyer_name,
    body, auth.uid(), conversation_row.id, 'new', '[]'::jsonb
  );

  update public.conversations
     set last_message_at = now(), last_message_sender_id = auth.uid(),
         buyer_last_seen_at = now()
   where id = conversation_row.id;

  perform public.record_operational_metric_internal(
    'message_send_latency_ms',
    extract(epoch from (clock_timestamp() - started_at)) * 1000,
    'start', 1, '{}'::jsonb, now()
  );
  return conversation_row.id;
end;
$$;

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  started_at timestamptz := clock_timestamp();
  conversation_row public.conversations%rowtype;
  listing_row public.listings%rowtype;
  body text := public.normalize_message_body(p_message);
  buyer_name text;
  message_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into conversation_row from public.conversations
   where id = p_conversation_id
     and (buyer_id = auth.uid() or seller_id = auth.uid())
   for update;
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if conversation_row.state <> 'open'
    or conversation_row.buyer_blocked_at is not null
    or conversation_row.seller_blocked_at is not null
    or conversation_row.retention_until <= now()
  then
    raise exception 'conversation is unavailable' using errcode = '42501';
  end if;

  select * into listing_row from public.listings where id = conversation_row.listing_id;
  if not found then
    raise exception 'listing context is unavailable' using errcode = 'P0002';
  end if;
  select full_name into buyer_name from public.users where id = conversation_row.buyer_id;

  perform public.assert_message_rate_limit();
  insert into public.inquiries (
    listing_id, listing_title, seller_id, buyer_id, buyer_name,
    message, sender_id, conversation_id, status, attachments
  ) values (
    listing_row.id, listing_row.title, conversation_row.seller_id,
    conversation_row.buyer_id, buyer_name, body, auth.uid(),
    conversation_row.id, 'new', '[]'::jsonb
  ) returning id into message_id;

  update public.conversations
     set last_message_at = now(), last_message_sender_id = auth.uid(),
         buyer_last_seen_at = case when buyer_id = auth.uid() then now() else buyer_last_seen_at end,
         seller_last_seen_at = case when seller_id = auth.uid() then now() else seller_last_seen_at end
   where id = conversation_row.id;

  perform public.record_operational_metric_internal(
    'message_send_latency_ms',
    extract(epoch from (clock_timestamp() - started_at)) * 1000,
    'reply', 1, '{}'::jsonb, now()
  );
  return message_id;
end;
$$;

revoke all on function public.start_listing_conversation(uuid, text) from public, anon;
revoke all on function public.send_conversation_message(uuid, text) from public, anon;
grant execute on function public.start_listing_conversation(uuid, text) to authenticated;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Deterministic alert evaluation and founder health snapshot
-- ---------------------------------------------------------------------------

create or replace function public.upsert_operational_alert(
  p_alert_key text,
  p_severity text,
  p_observed_value numeric,
  p_threshold_value numeric,
  p_window_started_at timestamptz,
  p_window_ended_at timestamptz,
  p_details jsonb default '{}'::jsonb,
  p_is_open boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_alert_key !~ '^[a-z][a-z0-9_]{1,79}$'
    or p_severity not in ('warning', 'critical')
    or p_observed_value is null
    or p_threshold_value is null
    or p_window_started_at >= p_window_ended_at
    or jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object'
  then
    raise exception 'invalid operational alert' using errcode = '22023';
  end if;

  insert into public.operational_alerts (
    alert_key, severity, status, observed_value, threshold_value,
    window_started_at, window_ended_at, details, opened_at, last_seen_at, resolved_at
  ) values (
    p_alert_key, p_severity, case when p_is_open then 'open' else 'resolved' end,
    p_observed_value, p_threshold_value, p_window_started_at, p_window_ended_at,
    coalesce(p_details, '{}'::jsonb), now(), now(), case when p_is_open then null else now() end
  )
  on conflict (alert_key) do update set
    severity = excluded.severity,
    status = excluded.status,
    observed_value = excluded.observed_value,
    threshold_value = excluded.threshold_value,
    window_started_at = excluded.window_started_at,
    window_ended_at = excluded.window_ended_at,
    details = excluded.details,
    opened_at = case
      when public.operational_alerts.status = 'resolved' and excluded.status = 'open' then now()
      else public.operational_alerts.opened_at
    end,
    last_seen_at = now(),
    resolved_at = case when excluded.status = 'resolved' then now() else null end;
end;
$$;

create or replace function public.evaluate_operational_alerts(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  window_start timestamptz := p_now - interval '1 hour';
  processing_attempts numeric := 0;
  processing_failures numeric := 0;
  processing_failure_rate numeric := 0;
  abandoned_uploads numeric := 0;
  feed_failures numeric := 0;
  feed_max_latency numeric := 0;
  message_max_latency numeric := 0;
  cleanup_dead_letters numeric := 0;
  cache_dead_letters numeric := 0;
  queue_processing_due numeric := 0;
  queue_processing_failed numeric := 0;
  queue_cleanup_pending numeric := 0;
  queue_cache_pending numeric := 0;
  storage_bucket timestamptz := date_trunc('hour', p_now);
  storage_tour_rows numeric := 0;
  storage_source_bytes numeric := 0;
  storage_playback_bytes numeric := 0;
  storage_ready_public numeric := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select coalesce(sum(sample_count), 0) into processing_attempts
  from public.operational_metric_buckets
  where metric_name = 'processing_dispatched' and bucket_start >= date_trunc('hour', window_start);

  select coalesce(sum(sample_count), 0) into processing_failures
  from public.operational_metric_buckets
  where metric_name = 'processing_failed' and bucket_start >= date_trunc('hour', window_start);

  processing_failure_rate := case
    when processing_attempts = 0 then 0
    else processing_failures / processing_attempts
  end;

  select coalesce(sum(sample_count), 0) into abandoned_uploads
  from public.operational_metric_buckets
  where metric_name = 'upload_abandoned' and bucket_start >= date_trunc('hour', window_start);

  select coalesce(sum(sample_count), 0) into feed_failures
  from public.operational_metric_buckets
  where metric_name = 'feed_failed' and bucket_start >= date_trunc('hour', window_start);

  select coalesce(max(value_max), 0) into feed_max_latency
  from public.operational_metric_buckets
  where metric_name = 'feed_latency_ms' and bucket_start >= date_trunc('hour', window_start);

  select coalesce(max(value_max), 0) into message_max_latency
  from public.operational_metric_buckets
  where metric_name = 'message_send_latency_ms' and bucket_start >= date_trunc('hour', window_start);

  -- Queue gauges are sampled at most once per UTC hour. This keeps founder
  -- dashboard reads constant-time while still exposing bounded operational
  -- backlog and dead-letter state at a useful release-monitoring cadence.
  perform pg_advisory_xact_lock(hashtextextended('findit_operational_queue_snapshot', 0));
  if not exists (
    select 1 from public.operational_metric_buckets
    where bucket_start = storage_bucket
      and metric_name = 'queue_processing_due'
      and dimension = 'all'
  ) then
    select count(*)::numeric into queue_processing_due
    from public.listing_tours
    where status in ('uploaded', 'processing')
      and coalesce(processing_retry_at, p_now) <= p_now;

    select count(*)::numeric into queue_processing_failed
    from public.listing_tours where status = 'failed';

    select
      count(*) filter (where state in ('pending', 'claimed'))::numeric,
      count(*) filter (where state = 'dead_lettered')::numeric
    into queue_cleanup_pending, cleanup_dead_letters
    from public.tour_asset_cleanup_queue;

    select
      count(*) filter (where processed_at is null and dead_lettered_at is null)::numeric,
      count(*) filter (where processed_at is null and dead_lettered_at is not null)::numeric
    into queue_cache_pending, cache_dead_letters
    from public.tour_cache_invalidations;

    insert into public.operational_metric_buckets (
      bucket_start, metric_name, dimension, sample_count, value_sum,
      value_max, last_value, metadata, first_recorded_at, last_recorded_at
    ) values
      (storage_bucket, 'queue_processing_due', 'all', 1, queue_processing_due, queue_processing_due, queue_processing_due, '{}'::jsonb, now(), now()),
      (storage_bucket, 'queue_processing_failed', 'all', 1, queue_processing_failed, queue_processing_failed, queue_processing_failed, '{}'::jsonb, now(), now()),
      (storage_bucket, 'queue_cleanup_pending', 'all', 1, queue_cleanup_pending, queue_cleanup_pending, queue_cleanup_pending, '{}'::jsonb, now(), now()),
      (storage_bucket, 'queue_cleanup_dead_lettered', 'all', 1, cleanup_dead_letters, cleanup_dead_letters, cleanup_dead_letters, '{}'::jsonb, now(), now()),
      (storage_bucket, 'queue_cache_pending', 'all', 1, queue_cache_pending, queue_cache_pending, queue_cache_pending, '{}'::jsonb, now(), now()),
      (storage_bucket, 'queue_cache_dead_lettered', 'all', 1, cache_dead_letters, cache_dead_letters, cache_dead_letters, '{}'::jsonb, now(), now())
    on conflict (bucket_start, metric_name, dimension) do nothing;
  end if;

  select
    coalesce(max(last_value) filter (where metric_name = 'queue_cleanup_dead_lettered'), 0),
    coalesce(max(last_value) filter (where metric_name = 'queue_cache_dead_lettered'), 0)
  into cleanup_dead_letters, cache_dead_letters
  from public.operational_metric_buckets
  where bucket_start = storage_bucket
    and dimension = 'all'
    and metric_name in ('queue_cleanup_dead_lettered', 'queue_cache_dead_lettered');

  -- Storage gauges require an aggregate scan of listing_tours. Serialize and
  -- capture them at most once per UTC hour so founder dashboard refreshes never
  -- turn into repeated million-row scans.
  perform pg_advisory_xact_lock(hashtextextended('findit_operational_storage_snapshot', 0));
  if not exists (
    select 1 from public.operational_metric_buckets
    where bucket_start = storage_bucket
      and metric_name = 'storage_tour_rows'
      and dimension = 'all'
  ) then
    select
      count(*)::numeric,
      coalesce(sum(source_byte_size) filter (where source_deleted_at is null), 0)::numeric,
      coalesce(sum(processed_byte_size) filter (where playback_deleted_at is null), 0)::numeric,
      count(*) filter (
        where status = 'ready'
          and moderation_status = 'approved'
          and deleted_at is null
          and removed_at is null
      )::numeric
    into storage_tour_rows, storage_source_bytes, storage_playback_bytes, storage_ready_public
    from public.listing_tours;

    insert into public.operational_metric_buckets (
      bucket_start, metric_name, dimension, sample_count, value_sum,
      value_max, last_value, metadata, first_recorded_at, last_recorded_at
    ) values
      (storage_bucket, 'storage_tour_rows', 'all', 1, storage_tour_rows, storage_tour_rows, storage_tour_rows, '{}'::jsonb, now(), now()),
      (storage_bucket, 'storage_source_bytes_retained', 'all', 1, storage_source_bytes, storage_source_bytes, storage_source_bytes, '{}'::jsonb, now(), now()),
      (storage_bucket, 'storage_playback_bytes_retained', 'all', 1, storage_playback_bytes, storage_playback_bytes, storage_playback_bytes, '{}'::jsonb, now(), now()),
      (storage_bucket, 'storage_ready_public', 'all', 1, storage_ready_public, storage_ready_public, storage_ready_public, '{}'::jsonb, now(), now())
    on conflict (bucket_start, metric_name, dimension) do nothing;
  end if;

  perform public.upsert_operational_alert(
    'tour_processing_failure_rate', 'critical', processing_failure_rate, 0.10,
    window_start, p_now,
    jsonb_build_object('attempts', processing_attempts, 'failures', processing_failures),
    processing_attempts >= 10 and processing_failure_rate >= 0.10
  );
  perform public.upsert_operational_alert(
    'tour_abandoned_uploads', 'warning', abandoned_uploads, 20,
    window_start, p_now, '{}'::jsonb, abandoned_uploads >= 20
  );
  perform public.upsert_operational_alert(
    'tour_feed_failures', 'critical', feed_failures, 5,
    window_start, p_now, '{}'::jsonb, feed_failures >= 5
  );
  perform public.upsert_operational_alert(
    'tour_feed_latency', 'warning', feed_max_latency, 2000,
    window_start, p_now, '{}'::jsonb, feed_max_latency >= 2000
  );
  perform public.upsert_operational_alert(
    'message_send_latency', 'warning', message_max_latency, 2000,
    window_start, p_now, '{}'::jsonb, message_max_latency >= 2000
  );
  perform public.upsert_operational_alert(
    'tour_cleanup_dead_letters', 'critical', cleanup_dead_letters, 1,
    window_start, p_now, '{}'::jsonb, cleanup_dead_letters >= 1
  );
  perform public.upsert_operational_alert(
    'tour_cache_dead_letters', 'critical', cache_dead_letters, 1,
    window_start, p_now, '{}'::jsonb, cache_dead_letters >= 1
  );

  return jsonb_build_object(
    'evaluated_at', p_now,
    'open_alerts', (select count(*) from public.operational_alerts where status = 'open'),
    'processing_failure_rate', processing_failure_rate,
    'abandoned_uploads', abandoned_uploads,
    'feed_failures', feed_failures,
    'feed_max_latency_ms', feed_max_latency,
    'message_max_latency_ms', message_max_latency,
    'cleanup_dead_letters', cleanup_dead_letters,
    'cache_dead_letters', cache_dead_letters
  );
end;
$$;

create or replace function public.prune_operational_metrics(
  p_before timestamptz default now() - interval '90 days'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_before > now() - interval '30 days' or p_before < now() - interval '400 days' then
    raise exception 'metric retention boundary is invalid' using errcode = '22023';
  end if;
  delete from public.operational_metric_buckets where bucket_start < p_before;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.admin_operational_health(p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz;
  storage_snapshot jsonb := jsonb_build_object(
    'tour_rows', 0,
    'source_bytes_retained', 0,
    'playback_bytes_retained', 0,
    'ready_public', 0
  );
  storage_snapshot_at timestamptz;
  queue_snapshot jsonb := jsonb_build_object(
    'processing_due', 0,
    'processing_failed', 0,
    'cleanup_pending', 0,
    'cleanup_dead_lettered', 0,
    'cache_pending', 0,
    'cache_dead_lettered', 0
  );
  queue_snapshot_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_hours not between 1 and 168 then
    raise exception 'health window is invalid' using errcode = '22023';
  end if;
  since := date_trunc('hour', now() - make_interval(hours => p_hours));

  select
    storage_snapshot || coalesce(jsonb_object_agg(
      regexp_replace(metric_name, '^storage_', ''),
      coalesce(last_value, 0)
    ), '{}'::jsonb),
    max(bucket_start)
  into storage_snapshot, storage_snapshot_at
  from (
    select distinct on (metric_name)
      metric_name, last_value, bucket_start
    from public.operational_metric_buckets
    where metric_name in (
      'storage_tour_rows',
      'storage_source_bytes_retained',
      'storage_playback_bytes_retained',
      'storage_ready_public'
    )
    order by metric_name, bucket_start desc
  ) latest_storage;

  select
    queue_snapshot || coalesce(jsonb_object_agg(
      regexp_replace(metric_name, '^queue_', ''),
      coalesce(last_value, 0)
    ), '{}'::jsonb),
    max(bucket_start)
  into queue_snapshot, queue_snapshot_at
  from (
    select distinct on (metric_name)
      metric_name, last_value, bucket_start
    from public.operational_metric_buckets
    where metric_name in (
      'queue_processing_due',
      'queue_processing_failed',
      'queue_cleanup_pending',
      'queue_cleanup_dead_lettered',
      'queue_cache_pending',
      'queue_cache_dead_lettered'
    )
    order by metric_name, bucket_start desc
  ) latest_queues;

  return jsonb_build_object(
    'window_hours', p_hours,
    'generated_at', now(),
    'open_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', alert_key,
        'severity', severity,
        'observed', observed_value,
        'threshold', threshold_value,
        'last_seen_at', last_seen_at,
        'details', details
      ) order by case severity when 'critical' then 0 else 1 end, last_seen_at desc)
      from public.operational_alerts where status = 'open'
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_object_agg(metric_name, jsonb_build_object(
        'samples', samples,
        'average', average_value,
        'maximum', maximum_value
      ))
      from (
        select metric_name,
          sum(sample_count)::bigint as samples,
          case when sum(sample_count) = 0 then 0 else sum(value_sum) / sum(sample_count) end as average_value,
          max(value_max) as maximum_value
        from public.operational_metric_buckets
        where bucket_start >= since
        group by metric_name
      ) metric_rows
    ), '{}'::jsonb),
    'queues', queue_snapshot,
    'queue_snapshot_at', queue_snapshot_at,
    'storage_snapshot_at', storage_snapshot_at,
    'storage', storage_snapshot
  );
end;
$$;

revoke all on function public.upsert_operational_alert(text, text, numeric, numeric, timestamptz, timestamptz, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.evaluate_operational_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.prune_operational_metrics(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_operational_health(integer) from public, anon;
grant execute on function public.evaluate_operational_alerts(timestamptz) to service_role;
grant execute on function public.prune_operational_metrics(timestamptz) to service_role;
grant execute on function public.admin_operational_health(integer) to authenticated;

comment on table public.operational_metric_buckets is
  'Hourly compact operational metrics. No user content, IP addresses, or raw per-request event stream.';
comment on function public.message_inbox_page(text, boolean, timestamptz, uuid, integer) is
  'Bounded keyset inbox page. Returns limit+1 rows so the client can derive a next cursor without an exact count.';
comment on function public.message_thread_page(uuid, timestamptz, uuid, integer) is
  'Bounded newest-first message page. Returns limit+1 rows for duplicate-free keyset traversal.';

-- Lifecycle triggers emit only compact aggregate metrics. They deliberately do
-- not copy user IDs, filenames, titles, message text, or storage paths.
create or replace function public.record_tour_upload_intent_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_operational_metric_internal(
      'upload_intent_created', 1,
      case when exists (select 1 from public.listing_tours where id = new.tour_id and service_id is not null)
        then 'service' else 'listing' end,
      1, jsonb_build_object('declared_bytes', new.declared_byte_size), new.created_at
    );
  elsif new.state = 'uploaded' and old.state is distinct from 'uploaded' then
    perform public.record_operational_metric_internal(
      'upload_completed',
      extract(epoch from (coalesce(new.uploaded_at, now()) - new.created_at)) * 1000,
      'all', 1, jsonb_build_object('declared_bytes', new.declared_byte_size), coalesce(new.uploaded_at, now())
    );
  end if;
  return new;
end;
$$;

create trigger trg_tour_upload_intent_metrics_insert
  after insert on public.listing_tour_upload_intents
  for each row execute function public.record_tour_upload_intent_metrics();

create trigger trg_tour_upload_intent_metrics_update
  after update of state on public.listing_tour_upload_intents
  for each row execute function public.record_tour_upload_intent_metrics();

create or replace function public.record_tour_processing_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_dimension text := case when new.service_id is not null then 'service' else 'listing' end;
  latency_ms numeric;
begin
  if new.status = 'processing' and old.status is distinct from 'processing' then
    latency_ms := extract(epoch from (coalesce(new.processing_started_at, now()) - coalesce(new.uploaded_at, new.created_at))) * 1000;
    perform public.record_operational_metric_internal(
      'processing_dispatched', greatest(latency_ms, 0), parent_dimension, 1,
      jsonb_build_object('attempt', new.processing_attempts), now()
    );
  end if;

  if new.status = 'ready' and old.status is distinct from 'ready' then
    latency_ms := extract(epoch from (coalesce(new.ready_at, now()) - coalesce(new.processing_started_at, new.uploaded_at, new.created_at))) * 1000;
    perform public.record_operational_metric_internal(
      'processing_completed_latency_ms', greatest(latency_ms, 0), parent_dimension, 1,
      jsonb_build_object('processed_bytes', new.processed_byte_size), coalesce(new.ready_at, now())
    );
  end if;

  if new.status = 'failed' and old.status is distinct from 'failed' then
    perform public.record_operational_metric_internal(
      'processing_failed', 1, parent_dimension, 1,
      jsonb_build_object('failure_code', coalesce(new.failure_code, 'unknown')), now()
    );
  end if;
  return new;
end;
$$;

create trigger trg_listing_tours_processing_metrics
  after update of status on public.listing_tours
  for each row execute function public.record_tour_processing_metrics();

create or replace function public.record_tour_cleanup_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.reason = 'abandoned_upload' then
    perform public.record_operational_metric_internal('upload_abandoned', 1, 'all', 1, '{}'::jsonb, new.created_at);
  elsif tg_op = 'UPDATE' and new.state = 'completed' and old.state is distinct from 'completed' then
    perform public.record_operational_metric_internal('cleanup_completed', 1, new.reason, 1, '{}'::jsonb, coalesce(new.completed_at, now()));
  elsif tg_op = 'UPDATE' and new.state = 'dead_lettered' and old.state is distinct from 'dead_lettered' then
    perform public.record_operational_metric_internal(
      'cleanup_failed', 1, new.reason, 1,
      jsonb_build_object('error_code', coalesce(new.error_code, 'unknown')), coalesce(new.dead_lettered_at, now())
    );
  end if;
  return new;
end;
$$;

create trigger trg_tour_cleanup_metrics_insert
  after insert on public.tour_asset_cleanup_queue
  for each row execute function public.record_tour_cleanup_metrics();

create trigger trg_tour_cleanup_metrics_update
  after update of state on public.tour_asset_cleanup_queue
  for each row execute function public.record_tour_cleanup_metrics();

create or replace function public.record_tour_cache_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.processed_at is not null and old.processed_at is null then
    perform public.record_operational_metric_internal('cache_invalidation_completed', 1, new.reason, 1, '{}'::jsonb, new.processed_at);
  elsif new.dead_lettered_at is not null and old.dead_lettered_at is null then
    perform public.record_operational_metric_internal(
      'cache_invalidation_failed', 1, new.reason, 1,
      jsonb_build_object('error_code', coalesce(new.error_code, 'unknown')), new.dead_lettered_at
    );
  end if;
  return new;
end;
$$;

create trigger trg_tour_cache_metrics
  after update of processed_at, dead_lettered_at on public.tour_cache_invalidations
  for each row execute function public.record_tour_cache_metrics();

create or replace function public.record_tour_report_metric()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'tour' then
    perform public.record_operational_metric_internal(
      'tour_report_submitted', 1, coalesce(new.tour_reason::text, new.reason::text), 1, '{}'::jsonb, new.created_at
    );
  end if;
  return new;
end;
$$;

create trigger trg_tour_report_metric
  after insert on public.reports
  for each row execute function public.record_tour_report_metric();
