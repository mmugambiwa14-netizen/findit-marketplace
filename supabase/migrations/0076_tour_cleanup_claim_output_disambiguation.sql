-- PostgreSQL exposes RETURNS TABLE columns as PL/pgSQL variables. Prefer table
-- columns inside the cleanup claim function so the tour_id conflict target and
-- queue predicates remain executable on the hosted PostgreSQL runtime.

create or replace function public.claim_tour_cleanup_jobs(
  p_batch_size integer default 20,
  p_now timestamptz default now()
)
returns table (
  cleanup_id uuid,
  lease_token uuid,
  tour_id uuid,
  intent_id uuid,
  source_storage_path text,
  playback_storage_path text,
  thumbnail_storage_path text,
  delete_source boolean,
  delete_playback boolean,
  delete_thumbnail boolean,
  reason text
) as $$
#variable_conflict use_column
begin
  if p_batch_size not between 1 and 100 then
    raise exception 'batch size must be between 1 and 100' using errcode = '22023';
  end if;

  -- Convert expired, never-completed upload intents into durable cleanup jobs.
  with expired as (
    select i.*
    from public.listing_tour_upload_intents i
    where i.state = 'authorized' and i.expires_at <= p_now
    order by i.expires_at, i.id
    for update skip locked
    limit p_batch_size
  ), queued as (
    insert into public.tour_asset_cleanup_queue (
      tour_id, intent_id, reason, source_storage_path, delete_source, eligible_at
    )
    select e.tour_id, e.id, 'abandoned_upload', e.source_storage_path, true, p_now
    from expired e
    on conflict (tour_id, reason) where tour_id is not null do nothing
    returning intent_id
  )
  update public.listing_tour_upload_intents i
  set state = 'cleanup_pending', cleanup_claimed_at = p_now,
      cleanup_attempts = cleanup_attempts + 1
  where i.id in (select intent_id from queued);

  update public.listing_tour_slots s
  set pending_tour_id = null
  where pending_tour_id in (
    select q.tour_id from public.tour_asset_cleanup_queue q
    where q.reason = 'abandoned_upload' and q.state = 'pending'
  );

  return query
  with candidates as (
    select q.id, gen_random_uuid() as new_lease_token
    from public.tour_asset_cleanup_queue q
    where q.state in ('pending', 'claimed')
      and q.attempts < 20
      and q.eligible_at <= p_now
      and coalesce(q.retry_at, q.eligible_at) <= p_now
      and (q.state = 'pending' or q.lease_until <= p_now)
    order by q.eligible_at, q.created_at, q.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.tour_asset_cleanup_queue q
    set state = 'claimed', lease_token = c.new_lease_token,
        lease_until = p_now + interval '15 minutes',
        retry_at = null, attempts = q.attempts + 1, error_code = null
    from candidates c
    where q.id = c.id
    returning q.*, c.new_lease_token
  )
  select c.id, c.new_lease_token, c.tour_id, c.intent_id,
    c.source_storage_path, c.playback_storage_path, c.thumbnail_storage_path,
    c.delete_source, c.delete_playback, c.delete_thumbnail, c.reason
  from claimed c;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.claim_tour_cleanup_jobs(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_tour_cleanup_jobs(integer, timestamptz)
  to service_role;

comment on function public.claim_tour_cleanup_jobs(integer, timestamptz) is
  'Claims bounded private Tour cleanup work with hosted-safe output-column disambiguation.';
