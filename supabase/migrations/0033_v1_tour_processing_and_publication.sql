-- 0033_v1_tour_processing_and_publication.sql
-- Service-only processing leases, idempotent finalization, private derived-media
-- buckets, and a public-eligibility contract that stays closed while the
-- database Tours switch is disabled.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tour-playback', 'tour-playback', false, 262144000, array['video/mp4']),
  ('tour-thumbnails', 'tour-thumbnails', false, 5242880, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.complete_tour_upload(
  p_user_id uuid,
  p_intent_id uuid
)
returns uuid as $$
declare
  intent public.listing_tour_upload_intents%rowtype;
  object_row storage.objects%rowtype;
  affected integer;
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;

  select * into intent
  from public.listing_tour_upload_intents
  where id = p_intent_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Tour upload intent not found' using errcode = 'P0002';
  end if;
  if intent.state in ('uploaded', 'processing', 'completed') then
    return intent.tour_id;
  end if;
  if intent.state <> 'authorized' or intent.expires_at <= now() then
    raise exception 'Tour upload intent is not active' using errcode = '22023';
  end if;

  select * into object_row
  from storage.objects
  where bucket_id = 'tour-sources'
    and name = intent.source_storage_path
    and owner_id = p_user_id::text;
  if not found then
    raise exception 'Tour source object is missing' using errcode = '22023';
  end if;
  if coalesce((object_row.metadata ->> 'size')::bigint, -1) <> intent.declared_byte_size
    or coalesce(object_row.metadata ->> 'mimetype', '') <> intent.declared_mime_type then
    raise exception 'Tour source object metadata mismatch' using errcode = '22023';
  end if;

  update public.listing_tour_upload_intents
  set state = 'uploaded', uploaded_at = now()
  where id = intent.id and state = 'authorized';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Tour upload completion raced with another operation' using errcode = '40001';
  end if;

  update public.listing_tours
  set status = 'uploaded', uploaded_at = now(), processing_retry_at = now(),
      failure_code = null, failure_message = null
  where id = intent.tour_id and status = 'upload_authorized';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Tour upload state is no longer valid' using errcode = '40001';
  end if;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status
  ) values (
    intent.tour_id, p_user_id, 'owner', 'upload_completed', 'upload_authorized', 'uploaded'
  );

  return intent.tour_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.claim_tour_processing_jobs(
  p_batch_size integer default 5,
  p_now timestamptz default now()
)
returns table (
  tour_id uuid,
  lease_token uuid,
  source_bucket text,
  source_storage_path text,
  playback_bucket text,
  playback_storage_path text,
  thumbnail_bucket text,
  thumbnail_storage_path text,
  declared_mime_type text,
  declared_byte_size bigint,
  declared_duration_seconds numeric,
  processing_attempt integer
) as $$
declare
  max_attempts integer := public.tour_processing_max_attempts();
begin
  if not public.is_backend_feature_enabled('tours') then
    return;
  end if;
  if p_batch_size not between 1 and 20 then
    raise exception 'batch size must be between 1 and 20' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select
      t.id,
      gen_random_uuid() as new_lease_token,
      case when t.listing_id is not null then 'listing' else 'service' end as parent_type,
      coalesce(t.listing_id, t.service_id) as parent_id
    from public.listing_tours t
    join public.listing_tour_slots s on s.pending_tour_id = t.id
    where t.deleted_at is null
      and t.moderation_status <> 'rejected'
      and t.processing_attempts < max_attempts
      and (
        (t.status = 'uploaded' and coalesce(t.processing_retry_at, p_now) <= p_now)
        or (t.status = 'failed' and t.processing_retry_at is not null and t.processing_retry_at <= p_now)
        or (t.status = 'processing' and t.processing_lease_until <= p_now)
      )
    order by coalesce(t.processing_retry_at, t.uploaded_at, t.created_at), t.id
    for update of t skip locked
    limit p_batch_size
  ), claimed as (
    update public.listing_tours t
    set status = 'processing',
        processing_attempts = t.processing_attempts + 1,
        processing_lease_token = c.new_lease_token,
        processing_lease_until = p_now + interval '20 minutes',
        processing_heartbeat_at = p_now,
        processing_started_at = coalesce(t.processing_started_at, p_now),
        processing_retry_at = null,
        processor_name = null,
        processor_job_id = null,
        failure_code = null,
        failure_message = null,
        playback_storage_path = c.parent_type || '/' || c.parent_id::text || '/' || t.id::text || '.mp4',
        thumbnail_storage_path = c.parent_type || '/' || c.parent_id::text || '/' || t.id::text || '.webp'
    from candidates c
    where t.id = c.id
    returning t.*, c.new_lease_token
  ), intents as (
    update public.listing_tour_upload_intents i
    set state = 'processing'
    from claimed c
    where i.tour_id = c.id and i.state in ('uploaded', 'processing')
    returning i.tour_id, i.declared_mime_type, i.declared_byte_size, i.declared_duration_seconds
  ), events as (
    insert into public.listing_tour_events (
      tour_id, actor_type, event_type, previous_status, next_status, metadata
    )
    select c.id, 'worker', 'processing_claimed', null, 'processing',
      jsonb_build_object('attempt', c.processing_attempts, 'leaseUntil', c.processing_lease_until)
    from claimed c
    returning tour_id
  )
  select
    c.id,
    c.new_lease_token,
    'tour-sources'::text,
    c.source_storage_path,
    'tour-playback'::text,
    c.playback_storage_path,
    'tour-thumbnails'::text,
    c.thumbnail_storage_path,
    i.declared_mime_type,
    i.declared_byte_size,
    i.declared_duration_seconds,
    c.processing_attempts
  from claimed c
  join intents i on i.tour_id = c.id;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.mark_tour_processing_dispatched(
  p_tour_id uuid,
  p_lease_token uuid,
  p_processor_name text,
  p_processor_job_id text
)
returns boolean as $$
declare
  affected integer;
begin
  if p_processor_name !~ '^[a-z0-9._-]{1,80}$'
    or length(trim(coalesce(p_processor_job_id, ''))) not between 1 and 255 then
    raise exception 'invalid processor identity' using errcode = '22023';
  end if;

  update public.listing_tours
  set processor_name = p_processor_name,
      processor_job_id = left(trim(p_processor_job_id), 255),
      processing_heartbeat_at = now(),
      processing_lease_until = greatest(processing_lease_until, now() + interval '20 minutes')
  where id = p_tour_id
    and status = 'processing'
    and processing_lease_token = p_lease_token
    and processing_lease_until > now();
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.authorize_tour_processing_callback(
  p_tour_id uuid,
  p_lease_token uuid,
  p_processor_job_id text
)
returns boolean as $$
declare
  affected integer;
  normalized_job_id text := left(trim(coalesce(p_processor_job_id, '')), 255);
begin
  if length(normalized_job_id) not between 1 and 255 then
    raise exception 'invalid processor job identity' using errcode = '22023';
  end if;

  -- Bind the first authenticated callback when dispatch metadata persistence was
  -- temporarily unavailable, and reject callback/job cross-wiring afterwards.
  update public.listing_tours
  set processor_job_id = coalesce(processor_job_id, normalized_job_id),
      processing_heartbeat_at = now()
  where id = p_tour_id
    and status = 'processing'
    and processing_lease_token = p_lease_token
    and processing_lease_until > now() - interval '5 minutes'
    and (processor_job_id is null or processor_job_id = normalized_job_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.heartbeat_tour_processing(
  p_tour_id uuid,
  p_lease_token uuid,
  p_extend_minutes integer default 20
)
returns boolean as $$
declare
  affected integer;
begin
  if p_extend_minutes not between 1 and 60 then
    raise exception 'heartbeat extension must be between 1 and 60 minutes' using errcode = '22023';
  end if;
  update public.listing_tours
  set processing_heartbeat_at = now(),
      processing_lease_until = now() + make_interval(mins => p_extend_minutes)
  where id = p_tour_id
    and status = 'processing'
    and processing_lease_token = p_lease_token
    and processing_lease_until > now() - interval '5 minutes';
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.finalize_tour_processing(
  p_tour_id uuid,
  p_lease_token uuid,
  p_duration_seconds numeric,
  p_width integer,
  p_height integer,
  p_processed_byte_size bigint,
  p_detected_container text,
  p_detected_video_codec text,
  p_detected_audio_codec text,
  p_checksum_sha256 text default null
)
returns boolean as $$
declare
  tour public.listing_tours%rowtype;
  playback_object storage.objects%rowtype;
  thumbnail_object storage.objects%rowtype;
  expected_ratio numeric;
begin
  if p_duration_seconds not between 0.001 and 120
    or p_width not between 1 and 1280
    or p_height not between 1 and 1280
    or greatest(p_width, p_height) > 1280
    or least(p_width, p_height) > 720
    or p_processed_byte_size not between 1 and 262144000
    or lower(p_detected_container) <> 'mp4'
    or lower(p_detected_video_codec) not in ('h264', 'avc1')
    or (p_detected_audio_codec is not null and lower(p_detected_audio_codec) not in ('aac', 'mp4a'))
    or p_checksum_sha256 is null
    or lower(p_checksum_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid processed Tour metadata' using errcode = '22023';
  end if;

  select * into tour from public.listing_tours
  where id = p_tour_id
    and status = 'processing'
    and processing_lease_token = p_lease_token
    and processing_lease_until > now() - interval '5 minutes'
  for update;
  if not found then
    return false;
  end if;

  select * into playback_object from storage.objects
  where bucket_id = 'tour-playback' and name = tour.playback_storage_path;
  if not found
    or coalesce(playback_object.metadata ->> 'mimetype', '') <> 'video/mp4'
    or coalesce((playback_object.metadata ->> 'size')::bigint, -1) <> p_processed_byte_size then
    raise exception 'processed playback object is missing or invalid' using errcode = '22023';
  end if;

  select * into thumbnail_object from storage.objects
  where bucket_id = 'tour-thumbnails' and name = tour.thumbnail_storage_path;
  if not found
    or coalesce(thumbnail_object.metadata ->> 'mimetype', '') <> 'image/webp'
    or coalesce((thumbnail_object.metadata ->> 'size')::bigint, -1) not between 1 and 5242880 then
    raise exception 'Tour thumbnail object is missing or invalid' using errcode = '22023';
  end if;

  expected_ratio := round((p_width::numeric / p_height::numeric), 6);
  update public.listing_tours
  set status = 'ready',
      duration_seconds = p_duration_seconds,
      width = p_width,
      height = p_height,
      aspect_ratio = expected_ratio,
      processed_byte_size = p_processed_byte_size,
      detected_container = lower(p_detected_container),
      detected_video_codec = lower(p_detected_video_codec),
      detected_audio_codec = lower(p_detected_audio_codec),
      checksum_sha256 = lower(p_checksum_sha256),
      ready_at = now(),
      processing_lease_token = null,
      processing_lease_until = null,
      processing_heartbeat_at = now(),
      processing_retry_at = null,
      failure_code = null,
      failure_message = null
  where id = tour.id;

  update public.listing_tour_upload_intents
  set state = 'completed'
  where tour_id = tour.id and state = 'processing';

  insert into public.listing_tour_events (
    tour_id, actor_type, event_type, previous_status, next_status,
    metadata
  ) values (
    tour.id, 'worker', 'processing_completed', 'processing', 'ready',
    jsonb_build_object(
      'durationSeconds', p_duration_seconds,
      'width', p_width,
      'height', p_height,
      'processedByteSize', p_processed_byte_size
    )
  );
  return true;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.fail_tour_processing(
  p_tour_id uuid,
  p_lease_token uuid,
  p_failure_code text,
  p_failure_message text,
  p_retryable boolean default true
)
returns boolean as $$
declare
  tour public.listing_tours%rowtype;
  retry_at timestamptz;
  max_attempts integer := public.tour_processing_max_attempts();
begin
  if lower(trim(coalesce(p_failure_code, ''))) !~ '^[a-z0-9_]{1,80}$'
    or length(trim(coalesce(p_failure_message, ''))) not between 1 and 1000 then
    raise exception 'invalid Tour processing failure' using errcode = '22023';
  end if;

  select * into tour from public.listing_tours
  where id = p_tour_id
    and status = 'processing'
    and processing_lease_token = p_lease_token
  for update;
  if not found then
    return false;
  end if;

  retry_at := case
    when p_retryable and tour.processing_attempts < max_attempts
      then now() + make_interval(mins => 5 * (2 ^ greatest(tour.processing_attempts - 1, 0))::integer)
    else null
  end;

  update public.listing_tours
  set status = 'failed',
      failure_code = lower(trim(p_failure_code)),
      failure_message = left(trim(p_failure_message), 1000),
      processing_retry_at = retry_at,
      processing_lease_token = null,
      processing_lease_until = null,
      processing_heartbeat_at = now()
  where id = tour.id;

  insert into public.listing_tour_events (
    tour_id, actor_type, event_type, previous_status, next_status, metadata
  ) values (
    tour.id, 'worker', 'processing_failed', 'processing', 'failed',
    jsonb_build_object(
      'failureCode', lower(trim(p_failure_code)),
      'retryable', p_retryable,
      'retryAt', retry_at,
      'attempt', tour.processing_attempts
    )
  );
  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_tour_parent_public(
  p_listing_id uuid,
  p_service_id uuid
)
returns boolean as $$
  select case
    when p_listing_id is not null then exists (
      select 1
      from public.listings l
      join public.users owner on owner.id = l.seller_id
      where l.id = p_listing_id
        and l.status in ('available', 'under_offer')
        and owner.status = 'active'
    )
    when p_service_id is not null then exists (
      select 1
      from public.services s
      join public.users owner on owner.id = s.provider_id
      where s.id = p_service_id
        and s.status = 'active'
        and s.category <> 'legal'
        and owner.status = 'active'
    )
    else false
  end;
$$ language sql stable security definer set search_path = public;

create or replace function public.is_tour_public_eligible(p_tour_id uuid)
returns boolean as $$
  select public.is_backend_feature_enabled('tours') and exists (
    select 1
    from public.listing_tours t
    join public.listing_tour_slots s on s.current_tour_id = t.id
    where t.id = p_tour_id
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and t.playback_storage_path is not null
      and t.thumbnail_storage_path is not null
      and public.is_tour_parent_public(t.listing_id, t.service_id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.public_tour_metadata(
  p_listing_id uuid default null,
  p_service_id uuid default null
)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  duration_seconds numeric,
  width integer,
  height integer,
  thumbnail_storage_path text,
  playback_storage_path text,
  published_at timestamptz
) as $$
begin
  if (p_listing_id is null) = (p_service_id is null) then
    raise exception 'exactly one Tour parent is required' using errcode = '22023';
  end if;
  if not public.is_backend_feature_enabled('tours') then
    return;
  end if;

  return query
  select
    t.id,
    case when t.listing_id is not null then 'listing' else 'service' end,
    coalesce(t.listing_id, t.service_id),
    t.duration_seconds,
    t.width,
    t.height,
    t.thumbnail_storage_path,
    t.playback_storage_path,
    t.published_at
  from public.listing_tour_slots s
  join public.listing_tours t on t.id = s.current_tour_id
  where s.listing_id is not distinct from p_listing_id
    and s.service_id is not distinct from p_service_id
    and public.is_tour_public_eligible(t.id)
  limit 1;
end;
$$ language plpgsql stable security definer set search_path = public;

create index idx_listing_tours_processing_queue
  on public.listing_tours(status, processing_retry_at, processing_lease_until, created_at, id)
  where deleted_at is null and status in ('uploaded', 'processing', 'failed');
create index idx_listing_tours_public_candidate
  on public.listing_tours(published_at desc, id desc)
  where status = 'ready' and moderation_status = 'approved' and deleted_at is null;
create index idx_listing_tours_listing_created
  on public.listing_tours(listing_id, created_at desc) where listing_id is not null;
create index idx_listing_tours_service_created
  on public.listing_tours(service_id, created_at desc) where service_id is not null;
create index idx_listing_tours_owner_created
  on public.listing_tours(owner_id, created_at desc);

revoke all on function public.claim_tour_processing_jobs(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_tour_processing_dispatched(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.authorize_tour_processing_callback(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.heartbeat_tour_processing(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.finalize_tour_processing(uuid, uuid, numeric, integer, integer, bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_tour_processing(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.is_tour_parent_public(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_tour_public_eligible(uuid) from public, anon, authenticated;
revoke all on function public.public_tour_metadata(uuid, uuid) from public, anon, authenticated;

grant execute on function public.claim_tour_processing_jobs(integer, timestamptz) to service_role;
grant execute on function public.mark_tour_processing_dispatched(uuid, uuid, text, text) to service_role;
grant execute on function public.authorize_tour_processing_callback(uuid, uuid, text) to service_role;
grant execute on function public.heartbeat_tour_processing(uuid, uuid, integer) to service_role;
grant execute on function public.finalize_tour_processing(uuid, uuid, numeric, integer, integer, bigint, text, text, text, text) to service_role;
grant execute on function public.fail_tour_processing(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.is_tour_parent_public(uuid, uuid) to service_role;
grant execute on function public.is_tour_public_eligible(uuid) to service_role;
grant execute on function public.public_tour_metadata(uuid, uuid) to service_role;
