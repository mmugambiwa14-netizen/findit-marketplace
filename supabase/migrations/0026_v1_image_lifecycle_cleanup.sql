-- 0026_v1_image_lifecycle_cleanup.sql
-- Adds an idempotent service-only lifecycle boundary for expired V1 image
-- upload intents. Claiming changes the intent state before object deletion so
-- an upload cannot be attached concurrently. Failed deletions retain the
-- expired intent and use a bounded retry time without reopening upload access.

alter table public.listing_upload_intents
  drop constraint listing_upload_intents_state_check;
alter table public.listing_upload_intents
  add constraint listing_upload_intents_state_check
  check (state in ('validated', 'uploaded', 'attached', 'rejected', 'cleanup_pending', 'cleaned')),
  add column cleanup_previous_state text
    check (cleanup_previous_state in ('validated', 'uploaded', 'rejected')),
  add column cleanup_claimed_at timestamptz,
  add column cleanup_retry_at timestamptz,
  add column cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  add column cleanup_error_code text check (
    cleanup_error_code is null or cleanup_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  add column cleaned_at timestamptz,
  add constraint listing_upload_intents_cleanup_claim_consistency check (
    (state = 'cleanup_pending' and cleanup_previous_state is not null and cleanup_claimed_at is not null)
    or (state <> 'cleanup_pending' and cleanup_previous_state is null and cleanup_claimed_at is null)
  );

drop index public.idx_listing_upload_intents_expiry;
create index idx_listing_upload_intents_expiry
  on public.listing_upload_intents(expires_at, cleanup_retry_at)
  where state in ('validated', 'uploaded', 'rejected', 'cleanup_pending');

alter table public.marketplace_image_upload_intents
  drop constraint marketplace_image_upload_intents_state_check;
alter table public.marketplace_image_upload_intents
  add constraint marketplace_image_upload_intents_state_check
  check (state in ('validated', 'uploaded', 'attached', 'rejected', 'cleanup_pending', 'cleaned')),
  add column cleanup_previous_state text
    check (cleanup_previous_state in ('validated', 'uploaded', 'rejected')),
  add column cleanup_claimed_at timestamptz,
  add column cleanup_retry_at timestamptz,
  add column cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  add column cleanup_error_code text check (
    cleanup_error_code is null or cleanup_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  add column cleaned_at timestamptz,
  add constraint marketplace_image_intents_cleanup_claim_consistency check (
    (state = 'cleanup_pending' and cleanup_previous_state is not null and cleanup_claimed_at is not null)
    or (state <> 'cleanup_pending' and cleanup_previous_state is null and cleanup_claimed_at is null)
  );

drop index public.idx_marketplace_image_intents_expiry;
create index idx_marketplace_image_intents_expiry
  on public.marketplace_image_upload_intents(expires_at, cleanup_retry_at)
  where state in ('validated', 'uploaded', 'rejected', 'cleanup_pending');

create or replace function public.claim_expired_image_uploads(
  p_batch_size integer default 50,
  p_now timestamptz default now()
)
returns table (
  intent_kind text,
  intent_id uuid,
  bucket_id text,
  storage_path text
) as $$
declare
  listing_claim_count integer := 0;
  remaining_count integer;
begin
  if p_batch_size not between 1 and 100 then
    raise exception 'batch size must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select i.id
    from public.listing_upload_intents i
    where ((
        i.state in ('validated', 'uploaded', 'rejected')
        and i.expires_at <= p_now
        and (i.cleanup_retry_at is null or i.cleanup_retry_at <= p_now)
      ) or (
        i.state = 'cleanup_pending'
        and i.cleanup_claimed_at <= p_now - interval '15 minutes'
      ))
      and not exists (
        select 1 from public.listing_media m where m.storage_path = i.storage_path
      )
    order by i.expires_at, i.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.listing_upload_intents i
    set cleanup_previous_state = case
          when i.state = 'cleanup_pending' then i.cleanup_previous_state
          else i.state
        end,
        state = 'cleanup_pending',
        cleanup_claimed_at = p_now,
        cleanup_retry_at = null,
        cleanup_attempts = i.cleanup_attempts + 1,
        cleanup_error_code = null
    from candidates c
    where i.id = c.id
    returning i.id, i.storage_path
  )
  select 'listing'::text, c.id, 'listing-images'::text, c.storage_path
  from claimed c;

  get diagnostics listing_claim_count = row_count;
  remaining_count := p_batch_size - listing_claim_count;
  if remaining_count <= 0 then
    return;
  end if;

  return query
  with candidates as (
    select i.id
    from public.marketplace_image_upload_intents i
    where ((
        i.state in ('validated', 'uploaded', 'rejected')
        and i.expires_at <= p_now
        and (i.cleanup_retry_at is null or i.cleanup_retry_at <= p_now)
      ) or (
        i.state = 'cleanup_pending'
        and i.cleanup_claimed_at <= p_now - interval '15 minutes'
      ))
      and not exists (
        select 1 from public.service_media m where m.storage_path = i.storage_path
      )
      and not exists (
        select 1 from public.business_profiles b where b.avatar_storage_path = i.storage_path
      )
    order by i.expires_at, i.id
    for update skip locked
    limit remaining_count
  ), claimed as (
    update public.marketplace_image_upload_intents i
    set cleanup_previous_state = case
          when i.state = 'cleanup_pending' then i.cleanup_previous_state
          else i.state
        end,
        state = 'cleanup_pending',
        cleanup_claimed_at = p_now,
        cleanup_retry_at = null,
        cleanup_attempts = i.cleanup_attempts + 1,
        cleanup_error_code = null
    from candidates c
    where i.id = c.id
    returning i.id, i.storage_path
  )
  select 'marketplace'::text, c.id, 'marketplace-images'::text, c.storage_path
  from claimed c;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.finalize_image_upload_cleanup(
  p_intent_kind text,
  p_intent_id uuid,
  p_succeeded boolean,
  p_error_code text default null,
  p_now timestamptz default now()
)
returns boolean as $$
declare
  affected integer;
  normalized_error text := lower(trim(coalesce(p_error_code, 'storage_remove_failed')));
begin
  if p_intent_kind not in ('listing', 'marketplace') then
    raise exception 'unsupported image intent kind' using errcode = '22023';
  end if;
  if not p_succeeded and normalized_error !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'invalid cleanup error code' using errcode = '22023';
  end if;

  if p_intent_kind = 'listing' then
    if p_succeeded then
      update public.listing_upload_intents
      set state = 'cleaned', cleaned_at = p_now, cleanup_previous_state = null,
          cleanup_claimed_at = null, cleanup_retry_at = null,
          cleanup_error_code = null
      where id = p_intent_id and state = 'cleanup_pending';
    else
      update public.listing_upload_intents
      set state = cleanup_previous_state, cleanup_previous_state = null,
          cleanup_claimed_at = null,
          cleanup_retry_at = p_now + interval '15 minutes',
          cleanup_error_code = normalized_error
      where id = p_intent_id and state = 'cleanup_pending'
        and cleanup_previous_state is not null;
    end if;
  else
    if p_succeeded then
      update public.marketplace_image_upload_intents
      set state = 'cleaned', cleaned_at = p_now, cleanup_previous_state = null,
          cleanup_claimed_at = null, cleanup_retry_at = null,
          cleanup_error_code = null
      where id = p_intent_id and state = 'cleanup_pending';
    else
      update public.marketplace_image_upload_intents
      set state = cleanup_previous_state, cleanup_previous_state = null,
          cleanup_claimed_at = null,
          cleanup_retry_at = p_now + interval '15 minutes',
          cleanup_error_code = normalized_error
      where id = p_intent_id and state = 'cleanup_pending'
        and cleanup_previous_state is not null;
    end if;
  end if;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.claim_expired_image_uploads(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_image_upload_cleanup(text, uuid, boolean, text, timestamptz) from public, anon, authenticated;
-- Migration 0019 revoked only PUBLIC, while the local Supabase default
-- privileges explicitly granted new functions to both browser roles. Correct
-- the older expiry worker in the same forward migration.
revoke all on function public.process_listing_expiry_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_expired_image_uploads(integer, timestamptz) to service_role;
grant execute on function public.finalize_image_upload_cleanup(text, uuid, boolean, text, timestamptz) to service_role;
grant execute on function public.process_listing_expiry_notifications(timestamptz) to service_role;
