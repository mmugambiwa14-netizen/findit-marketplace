-- Restore the pre-0075 claim function. This rollback preserves all Tour rows,
-- storage objects, events, and leases.

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

