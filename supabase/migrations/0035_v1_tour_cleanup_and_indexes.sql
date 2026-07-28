-- 0035_v1_tour_cleanup_and_indexes.sql
-- Durable object-cleanup queue, abandoned-upload recovery, parent-status cache
-- invalidation outbox, and final browser/service privilege hardening.

alter table public.listing_tours
  add column source_deleted_at timestamptz,
  add column playback_deleted_at timestamptz,
  add column thumbnail_deleted_at timestamptz;

create table public.tour_asset_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid,
  intent_id uuid,
  reason text not null check (
    reason in ('source_retention', 'abandoned_upload', 'terminal_media', 'failed_media', 'parent_deleted')
  ),
  source_storage_path text,
  playback_storage_path text,
  thumbnail_storage_path text,
  delete_source boolean not null default false,
  delete_playback boolean not null default false,
  delete_thumbnail boolean not null default false,
  eligible_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending', 'claimed', 'completed', 'dead_lettered')),
  lease_token uuid,
  lease_until timestamptz,
  retry_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 20),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  dead_lettered_at timestamptz,
  constraint tour_cleanup_has_asset check (delete_source or delete_playback or delete_thumbnail),
  constraint tour_cleanup_paths_consistent check (
    (not delete_source or source_storage_path is not null)
    and (not delete_playback or playback_storage_path is not null)
    and (not delete_thumbnail or thumbnail_storage_path is not null)
  ),
  constraint tour_cleanup_lease_consistent check (
    (state = 'claimed' and lease_token is not null and lease_until is not null)
    or (state <> 'claimed' and lease_token is null and lease_until is null)
  )
);

create unique index idx_tour_cleanup_unique_reason
  on public.tour_asset_cleanup_queue(tour_id, reason)
  where tour_id is not null;
create index idx_tour_cleanup_claim
  on public.tour_asset_cleanup_queue(state, eligible_at, retry_at, lease_until, created_at)
  where state in ('pending', 'claimed');

create table public.tour_cache_invalidations (
  id bigint generated always as identity primary key,
  tour_id uuid,
  parent_type text not null check (parent_type in ('listing', 'service')),
  parent_id uuid not null,
  reason text not null check (reason ~ '^[a-z][a-z0-9_]{1,79}$'),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 20),
  retry_at timestamptz,
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,80}$'),
  dead_lettered_at timestamptz
);

create index idx_tour_cache_invalidations_pending
  on public.tour_cache_invalidations(coalesce(retry_at, created_at), id)
  where processed_at is null;

alter table public.tour_asset_cleanup_queue enable row level security;
alter table public.tour_cache_invalidations enable row level security;
revoke all on table public.tour_asset_cleanup_queue from anon, authenticated;
revoke all on table public.tour_cache_invalidations from anon, authenticated;

create or replace function public.enqueue_tour_cleanup_on_state_change()
returns trigger as $$
declare
  retention_days integer := coalesce((
    select (configuration ->> 'sourceRetentionDays')::integer
    from public.marketplace_feature_controls where feature_key = 'tours'
  ), 7);
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    insert into public.tour_asset_cleanup_queue (
      tour_id, intent_id, reason, source_storage_path,
      delete_source, eligible_at
    ) values (
      new.id,
      (select id from public.listing_tour_upload_intents where tour_id = new.id),
      'source_retention', new.source_storage_path,
      true, coalesce(new.ready_at, now()) + make_interval(days => retention_days)
    ) on conflict (tour_id, reason) where tour_id is not null do nothing;
  end if;

  if new.status in ('removed', 'superseded') and old.status is distinct from new.status then
    insert into public.tour_asset_cleanup_queue (
      tour_id, intent_id, reason, source_storage_path, playback_storage_path,
      thumbnail_storage_path, delete_source, delete_playback, delete_thumbnail, eligible_at
    ) values (
      new.id,
      (select id from public.listing_tour_upload_intents where tour_id = new.id),
      'terminal_media', new.source_storage_path, new.playback_storage_path,
      new.thumbnail_storage_path, true,
      new.playback_storage_path is not null,
      new.thumbnail_storage_path is not null,
      now() + interval '24 hours'
    ) on conflict (tour_id, reason) where tour_id is not null do update set
      source_storage_path = excluded.source_storage_path,
      playback_storage_path = excluded.playback_storage_path,
      thumbnail_storage_path = excluded.thumbnail_storage_path,
      delete_source = excluded.delete_source,
      delete_playback = excluded.delete_playback,
      delete_thumbnail = excluded.delete_thumbnail,
      eligible_at = least(public.tour_asset_cleanup_queue.eligible_at, excluded.eligible_at),
      state = case when public.tour_asset_cleanup_queue.state = 'completed' then 'pending' else public.tour_asset_cleanup_queue.state end,
      completed_at = case when public.tour_asset_cleanup_queue.state = 'completed' then null else public.tour_asset_cleanup_queue.completed_at end;
  end if;

  if new.status = 'failed'
    and new.processing_retry_at is null
    and (old.status is distinct from 'failed' or old.processing_retry_at is not null) then
    insert into public.tour_asset_cleanup_queue (
      tour_id, intent_id, reason, source_storage_path, playback_storage_path,
      thumbnail_storage_path, delete_source, delete_playback, delete_thumbnail, eligible_at
    ) values (
      new.id,
      (select id from public.listing_tour_upload_intents where tour_id = new.id),
      'failed_media', new.source_storage_path, new.playback_storage_path,
      new.thumbnail_storage_path, true,
      new.playback_storage_path is not null,
      new.thumbnail_storage_path is not null,
      now() + interval '48 hours'
    ) on conflict (tour_id, reason) where tour_id is not null do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tours_enqueue_cleanup
  after update of status, processing_retry_at on public.listing_tours
  for each row execute function public.enqueue_tour_cleanup_on_state_change();

create or replace function public.enqueue_tour_cleanup_before_delete()
returns trigger as $$
begin
  insert into public.tour_asset_cleanup_queue (
    tour_id, intent_id, reason, source_storage_path, playback_storage_path,
    thumbnail_storage_path, delete_source, delete_playback, delete_thumbnail, eligible_at
  ) values (
    old.id,
    (select id from public.listing_tour_upload_intents where tour_id = old.id),
    'parent_deleted', old.source_storage_path, old.playback_storage_path,
    old.thumbnail_storage_path, true,
    old.playback_storage_path is not null,
    old.thumbnail_storage_path is not null,
    now()
  ) on conflict (tour_id, reason) where tour_id is not null do nothing;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tours_cleanup_before_delete
  before delete on public.listing_tours
  for each row execute function public.enqueue_tour_cleanup_before_delete();

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

create or replace function public.finalize_tour_cleanup_job(
  p_cleanup_id uuid,
  p_lease_token uuid,
  p_succeeded boolean,
  p_error_code text default null,
  p_now timestamptz default now()
)
returns boolean as $$
declare
  job public.tour_asset_cleanup_queue%rowtype;
  normalized_error text := lower(trim(coalesce(p_error_code, 'storage_remove_failed')));
begin
  if not p_succeeded and normalized_error !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'invalid cleanup error code' using errcode = '22023';
  end if;

  select * into job from public.tour_asset_cleanup_queue
  where id = p_cleanup_id and state = 'claimed' and lease_token = p_lease_token
  for update;
  if not found then
    return false;
  end if;

  if p_succeeded then
    update public.tour_asset_cleanup_queue
    set state = 'completed', lease_token = null, lease_until = null,
        retry_at = null, error_code = null, completed_at = p_now
    where id = job.id;

    if job.intent_id is not null and job.delete_source then
      update public.listing_tour_upload_intents
      set state = 'cleaned', cleanup_claimed_at = null,
          cleanup_retry_at = null, cleanup_error_code = null, cleaned_at = p_now
      where id = job.intent_id;
    end if;

    update public.listing_tours
    set source_deleted_at = case when job.delete_source then coalesce(source_deleted_at, p_now) else source_deleted_at end,
        playback_deleted_at = case when job.delete_playback then coalesce(playback_deleted_at, p_now) else playback_deleted_at end,
        thumbnail_deleted_at = case when job.delete_thumbnail then coalesce(thumbnail_deleted_at, p_now) else thumbnail_deleted_at end,
        status = case
          when job.reason in ('abandoned_upload', 'terminal_media', 'failed_media', 'parent_deleted')
            and job.delete_source and (job.playback_storage_path is null or job.delete_playback)
            and (job.thumbnail_storage_path is null or job.delete_thumbnail)
            and status not in ('ready')
          then 'cleaned'
          else status
        end
    where id = job.tour_id;
  else
    update public.tour_asset_cleanup_queue
    set state = case when job.attempts >= 20 then 'dead_lettered' else 'pending' end,
        lease_token = null,
        lease_until = null,
        retry_at = case
          when job.attempts >= 20 then null
          else p_now + make_interval(mins => least(240, 15 * greatest(job.attempts, 1)))
        end,
        error_code = normalized_error,
        dead_lettered_at = case when job.attempts >= 20 then p_now else null end
    where id = job.id;

    if job.intent_id is not null then
      update public.listing_tour_upload_intents
      set state = case
            when state = 'cleanup_pending' and job.attempts >= 20 then 'cleanup_failed'
            else state
          end,
          cleanup_claimed_at = case
            when job.attempts >= 20 then null
            else coalesce(cleanup_claimed_at, p_now)
          end,
          cleanup_retry_at = case when job.attempts >= 20 then null else p_now + interval '15 minutes' end,
          cleanup_error_code = normalized_error
      where id = job.intent_id and state = 'cleanup_pending';
    end if;
  end if;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.emit_listing_tour_parent_invalidation()
returns trigger as $$
declare
  current_tour uuid;
  reason text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;
  select current_tour_id into current_tour
  from public.listing_tour_slots where listing_id = new.id;
  reason := 'listing_status_' || new.status::text;

  insert into public.tour_cache_invalidations (tour_id, parent_type, parent_id, reason)
  values (current_tour, 'listing', new.id, reason);

  if current_tour is not null then
    update public.listing_tours
    set published_at = case
      when new.status in ('available', 'under_offer')
        and status = 'ready' and moderation_status = 'approved'
      then coalesce(published_at, now())
      else null
    end
    where id = current_tour;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listings_tour_invalidation
  after update of status on public.listings
  for each row execute function public.emit_listing_tour_parent_invalidation();

create or replace function public.emit_service_tour_parent_invalidation()
returns trigger as $$
declare
  current_tour uuid;
  reason text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;
  select current_tour_id into current_tour
  from public.listing_tour_slots where service_id = new.id;
  reason := 'service_status_' || new.status::text;

  insert into public.tour_cache_invalidations (tour_id, parent_type, parent_id, reason)
  values (current_tour, 'service', new.id, reason);

  if current_tour is not null then
    update public.listing_tours
    set published_at = case
      when new.status = 'active'
        and status = 'ready' and moderation_status = 'approved'
      then coalesce(published_at, now())
      else null
    end
    where id = current_tour;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_services_tour_invalidation
  after update of status on public.services
  for each row execute function public.emit_service_tour_parent_invalidation();

create or replace function public.emit_tour_slot_invalidation()
returns trigger as $$
begin
  if old.current_tour_id is distinct from new.current_tour_id then
    insert into public.tour_cache_invalidations (tour_id, parent_type, parent_id, reason)
    values
      (old.current_tour_id,
       case when new.listing_id is not null then 'listing' else 'service' end,
       coalesce(new.listing_id, new.service_id), 'current_tour_changed'),
      (new.current_tour_id,
       case when new.listing_id is not null then 'listing' else 'service' end,
       coalesce(new.listing_id, new.service_id), 'current_tour_changed');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_tour_slots_invalidation
  after update of current_tour_id on public.listing_tour_slots
  for each row execute function public.emit_tour_slot_invalidation();

create or replace function public.emit_tour_state_invalidation()
returns trigger as $$
begin
  if old.status is not distinct from new.status
    and old.moderation_status is not distinct from new.moderation_status
    and old.published_at is not distinct from new.published_at
    and old.deleted_at is not distinct from new.deleted_at
    and old.playback_storage_path is not distinct from new.playback_storage_path
    and old.thumbnail_storage_path is not distinct from new.thumbnail_storage_path then
    return new;
  end if;

  insert into public.tour_cache_invalidations (
    tour_id, parent_type, parent_id, reason
  ) values (
    new.id,
    case when new.listing_id is not null then 'listing' else 'service' end,
    coalesce(new.listing_id, new.service_id),
    'tour_state_changed'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tours_state_invalidation
  after update of status, moderation_status, published_at, deleted_at,
    playback_storage_path, thumbnail_storage_path on public.listing_tours
  for each row execute function public.emit_tour_state_invalidation();

create or replace function public.emit_tour_delete_invalidation()
returns trigger as $$
begin
  insert into public.tour_cache_invalidations (
    tour_id, parent_type, parent_id, reason
  ) values (
    old.id,
    case when old.listing_id is not null then 'listing' else 'service' end,
    coalesce(old.listing_id, old.service_id),
    'tour_deleted'
  );
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tours_delete_invalidation
  before delete on public.listing_tours
  for each row execute function public.emit_tour_delete_invalidation();

create or replace function public.claim_tour_cache_invalidations(
  p_batch_size integer default 100,
  p_now timestamptz default now()
)
returns table (
  invalidation_id bigint,
  claim_token uuid,
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  reason text
) as $$
begin
  if p_batch_size not between 1 and 500 then
    raise exception 'batch size must be between 1 and 500' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select i.id, gen_random_uuid() as token
    from public.tour_cache_invalidations i
    where i.processed_at is null
      and i.dead_lettered_at is null
      and i.attempts < 20
      and coalesce(i.retry_at, i.created_at) <= p_now
      and (i.claimed_at is null or i.claimed_at <= p_now - interval '15 minutes')
    order by i.created_at, i.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.tour_cache_invalidations i
    set claimed_at = p_now, claim_token = c.token,
        attempts = i.attempts + 1, retry_at = null, error_code = null
    from candidates c where i.id = c.id
    returning i.*, c.token
  )
  select c.id, c.token, c.tour_id, c.parent_type, c.parent_id, c.reason
  from claimed c;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.finalize_tour_cache_invalidation(
  p_invalidation_id bigint,
  p_claim_token uuid,
  p_succeeded boolean,
  p_error_code text default null
)
returns boolean as $$
declare
  affected integer;
  normalized_error text := lower(trim(coalesce(p_error_code, 'cache_purge_failed')));
begin
  if not p_succeeded and normalized_error !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'invalid cache error code' using errcode = '22023';
  end if;
  if p_succeeded then
    update public.tour_cache_invalidations
    set processed_at = now(), claimed_at = null, claim_token = null,
        retry_at = null, error_code = null
    where id = p_invalidation_id and claim_token = p_claim_token and processed_at is null;
  else
    update public.tour_cache_invalidations
    set claimed_at = null,
        claim_token = null,
        retry_at = case when attempts >= 20 then null else now() + interval '15 minutes' end,
        error_code = normalized_error,
        dead_lettered_at = case when attempts >= 20 then now() else null end
    where id = p_invalidation_id and claim_token = p_claim_token and processed_at is null;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger/helper functions are never browser APIs.
revoke execute on function public.enqueue_tour_cleanup_on_state_change() from public, anon, authenticated;
revoke execute on function public.enqueue_tour_cleanup_before_delete() from public, anon, authenticated;
revoke execute on function public.emit_listing_tour_parent_invalidation() from public, anon, authenticated;
revoke execute on function public.emit_service_tour_parent_invalidation() from public, anon, authenticated;
revoke execute on function public.emit_tour_slot_invalidation() from public, anon, authenticated;
revoke execute on function public.emit_tour_state_invalidation() from public, anon, authenticated;
revoke execute on function public.emit_tour_delete_invalidation() from public, anon, authenticated;

-- Internal worker functions are service-only.
revoke all on function public.claim_tour_cleanup_jobs(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_tour_cleanup_job(uuid, uuid, boolean, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_tour_cache_invalidations(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_tour_cache_invalidation(bigint, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_tour_cleanup_jobs(integer, timestamptz) to service_role;
grant execute on function public.finalize_tour_cleanup_job(uuid, uuid, boolean, text, timestamptz) to service_role;
grant execute on function public.claim_tour_cache_invalidations(integer, timestamptz) to service_role;
grant execute on function public.finalize_tour_cache_invalidation(bigint, uuid, boolean, text) to service_role;

-- Explicit service-role privileges keep worker access independent of hosted
-- default-privilege differences while browser roles remain restricted by the
-- narrower grants and RLS policies above.
grant all on table public.marketplace_feature_controls to service_role;
grant all on table public.listing_tours to service_role;
grant all on table public.listing_tour_slots to service_role;
grant all on table public.listing_tour_events to service_role;
grant all on table public.listing_tour_upload_intents to service_role;
grant all on table public.tour_asset_cleanup_queue to service_role;
grant all on table public.tour_cache_invalidations to service_role;
grant usage, select on sequence public.listing_tour_events_id_seq to service_role;
grant usage, select on sequence public.tour_cache_invalidations_id_seq to service_role;
