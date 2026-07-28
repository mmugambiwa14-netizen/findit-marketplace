-- 0036_v1_seller_tour_workflow.sql
-- Milestone 3 / C seller workflow bridge. A normal V1 listing is created in
-- pending_review before its optional Tour can receive a parent identifier.
-- This keeps direct uploads parent-owned while allowing the canonical create,
-- review, retry and renewal states. Public eligibility remains unchanged and
-- still requires an approved ready Tour on a publicly available parent.

create or replace function public.authorize_tour_upload(
  p_user_id uuid,
  p_tour_id uuid,
  p_listing_id uuid,
  p_service_id uuid,
  p_source_storage_path text,
  p_original_filename text,
  p_declared_mime_type text,
  p_declared_byte_size bigint,
  p_declared_duration_seconds numeric,
  p_sha256_hex text,
  p_idempotency_key uuid
)
returns table (intent_id uuid, tour_id uuid, source_storage_path text, expires_at timestamptz) as $$
declare
  expected_owner uuid;
  existing_intent public.listing_tour_upload_intents%rowtype;
  slot_row public.listing_tour_slots%rowtype;
  pending_status text;
  new_intent_id uuid;
  new_expiry timestamptz := now() + interval '30 minutes';
  extension text;
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;
  if p_user_id is null or p_tour_id is null or p_idempotency_key is null then
    raise exception 'user, Tour, and idempotency identifiers are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.users where id = p_user_id and status = 'active'
  ) then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into existing_intent
  from public.listing_tour_upload_intents
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_intent.state <> 'authorized' then
      raise exception 'Tour upload idempotency key is no longer active' using errcode = '22023';
    end if;

    -- The same idempotency key may only renew the exact parent and media
    -- declaration that created it. The edge function is free to generate and
    -- discard new candidate identifiers because this function returns the
    -- original server-owned Tour, intent and object path.
    if not exists (
      select 1
      from public.listing_tours existing_tour
      where existing_tour.id = existing_intent.tour_id
        and existing_tour.owner_id = p_user_id
        and existing_tour.listing_id is not distinct from p_listing_id
        and existing_tour.service_id is not distinct from p_service_id
        and existing_tour.status = 'upload_authorized'
    ) or existing_intent.declared_mime_type is distinct from p_declared_mime_type
      or existing_intent.declared_byte_size is distinct from p_declared_byte_size
      or existing_intent.declared_duration_seconds is distinct from p_declared_duration_seconds
      or existing_intent.sha256_hex is distinct from lower(p_sha256_hex) then
      raise exception 'Tour upload idempotency key does not match this upload' using errcode = '22023';
    end if;

    -- Renewal and idempotent replay must re-check the canonical parent. This
    -- prevents a stale authorization from being extended after a listing is
    -- sold/unavailable or a service becomes unavailable or legally excluded.
    expected_owner := public.resolve_tour_parent_owner(p_listing_id, p_service_id);
    if expected_owner <> p_user_id then
      raise exception 'Tour upload requires parent ownership' using errcode = '42501';
    end if;
    if p_listing_id is not null and not exists (
      select 1 from public.listings
      where id = p_listing_id
        and seller_id = p_user_id
        and status in ('draft', 'pending_review', 'available', 'under_offer', 'rejected', 'expired')
    ) then
      raise exception 'listing is not eligible for a Tour' using errcode = '42501';
    end if;
    if p_service_id is not null and not exists (
      select 1 from public.services
      where id = p_service_id
        and provider_id = p_user_id
        and category <> 'legal'
        and status <> 'unavailable'
    ) then
      raise exception 'service is not eligible for a Tour' using errcode = '42501';
    end if;

    if existing_intent.expires_at <= now() then
      update public.listing_tour_upload_intents
      set expires_at = new_expiry
      where id = existing_intent.id and state = 'authorized';

      insert into public.listing_tour_events (
        tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
      ) values (
        existing_intent.tour_id, p_user_id, 'owner',
        'upload_authorization_renewed', 'upload_authorized', 'upload_authorized',
        jsonb_build_object('intentId', existing_intent.id, 'expiresAt', new_expiry)
      );
      existing_intent.expires_at := new_expiry;
    end if;

    return query select existing_intent.id, existing_intent.tour_id,
      existing_intent.source_storage_path, existing_intent.expires_at;
    return;
  end if;

  expected_owner := public.resolve_tour_parent_owner(p_listing_id, p_service_id);
  if expected_owner <> p_user_id then
    raise exception 'Tour upload requires parent ownership' using errcode = '42501';
  end if;

  if p_listing_id is not null and not exists (
    select 1 from public.listings
    where id = p_listing_id
      and seller_id = p_user_id
      and status in ('draft', 'pending_review', 'available', 'under_offer', 'rejected', 'expired')
  ) then
    raise exception 'listing is not eligible for a Tour' using errcode = '42501';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services
    where id = p_service_id
      and provider_id = p_user_id
      and category <> 'legal'
      and status <> 'unavailable'
  ) then
    raise exception 'service is not eligible for a Tour' using errcode = '42501';
  end if;

  if p_declared_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm')
    or p_declared_byte_size not between 1 and 262144000
    or p_declared_duration_seconds not between 0.001 and 120
    or (p_sha256_hex is not null and lower(p_sha256_hex) !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid Tour source metadata' using errcode = '22023';
  end if;

  extension := case p_declared_mime_type
    when 'video/mp4' then 'mp4'
    when 'video/quicktime' then 'mov'
    when 'video/webm' then 'webm'
  end;
  if p_source_storage_path !~ (
    '^' || p_user_id::text || '/' || p_tour_id::text || '/source/[0-9a-f-]{36}\.' || extension || '$'
  ) then
    raise exception 'invalid Tour source path' using errcode = '22023';
  end if;

  if (
    select count(*) from public.listing_tour_upload_intents
    where user_id = p_user_id and created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Tour upload rate exceeded' using errcode = 'P0001';
  end if;

  if p_listing_id is not null then
    insert into public.listing_tour_slots (owner_id, listing_id)
    values (p_user_id, p_listing_id)
    on conflict (listing_id) where listing_id is not null do nothing;
    select * into slot_row from public.listing_tour_slots
    where listing_id = p_listing_id for update;
  else
    insert into public.listing_tour_slots (owner_id, service_id)
    values (p_user_id, p_service_id)
    on conflict (service_id) where service_id is not null do nothing;
    select * into slot_row from public.listing_tour_slots
    where service_id = p_service_id for update;
  end if;

  if slot_row.owner_id <> p_user_id then
    raise exception 'Tour slot ownership mismatch' using errcode = '42501';
  end if;

  if slot_row.pending_tour_id is not null then
    select status into pending_status
    from public.listing_tours where id = slot_row.pending_tour_id for update;
    if pending_status not in ('failed', 'removed', 'cleaned') then
      raise exception 'a pending Tour already exists for this parent' using errcode = '23505';
    end if;

    -- A failed pending version is terminal once the owner starts a replacement.
    -- Marking it removed before detaching the slot guarantees its source and any
    -- partial derived objects enter the durable cleanup lifecycle.
    if pending_status = 'failed' then
      update public.listing_tours
      set status = 'removed', removed_at = coalesce(removed_at, now()),
          processing_retry_at = null, published_at = null
      where id = slot_row.pending_tour_id;

      insert into public.listing_tour_events (
        tour_id, actor_id, actor_type, event_type, previous_status, next_status
      ) values (
        slot_row.pending_tour_id, p_user_id, 'owner',
        'failed_tour_replaced', 'failed', 'removed'
      );
    end if;

    update public.listing_tour_slots set pending_tour_id = null where id = slot_row.id;
  end if;

  insert into public.listing_tours (
    id, owner_id, listing_id, service_id, source_storage_path,
    status, moderation_status, mime_type, source_byte_size, checksum_sha256
  ) values (
    p_tour_id, p_user_id, p_listing_id, p_service_id, p_source_storage_path,
    'upload_authorized', 'pending', p_declared_mime_type,
    p_declared_byte_size, lower(p_sha256_hex)
  );

  insert into public.listing_tour_upload_intents (
    idempotency_key, tour_id, user_id, source_storage_path, original_filename,
    declared_mime_type, declared_byte_size, declared_duration_seconds,
    sha256_hex, expires_at
  ) values (
    p_idempotency_key, p_tour_id, p_user_id, p_source_storage_path,
    nullif(left(trim(coalesce(p_original_filename, '')), 255), ''),
    p_declared_mime_type, p_declared_byte_size, p_declared_duration_seconds,
    lower(p_sha256_hex), new_expiry
  ) returning id into new_intent_id;

  update public.listing_tour_slots
  set pending_tour_id = p_tour_id
  where id = slot_row.id;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
  ) values (
    p_tour_id, p_user_id, 'owner', 'upload_authorized', 'created', 'upload_authorized',
    jsonb_build_object('intentId', new_intent_id, 'expiresAt', new_expiry)
  );

  return query select new_intent_id, p_tour_id, p_source_storage_path, new_expiry;
end;
$$ language plpgsql security definer set search_path = public, storage;

revoke all on function public.authorize_tour_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) from public, anon, authenticated;
grant execute on function public.authorize_tour_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) to service_role;

-- Confirmation is deliberately allowed after authorization expiry when the
-- exact private object already exists. A signed upload could only have been
-- accepted while the authorization was active; this closes the network race
-- where Storage accepted the bytes just before the browser lost connectivity.
create or replace function public.complete_tour_upload(
  p_user_id uuid,
  p_intent_id uuid
)
returns uuid as $$
declare
  intent public.listing_tour_upload_intents%rowtype;
  object_row storage.objects%rowtype;
  affected integer;
  tour_affected integer;
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
  if intent.state <> 'authorized' then
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
  set status = 'uploaded', uploaded_at = now(), failure_code = null, failure_message = null
  where id = intent.tour_id and owner_id = p_user_id and status = 'upload_authorized';
  get diagnostics tour_affected = row_count;
  if tour_affected <> 1 then
    raise exception 'Tour upload was cancelled before confirmation' using errcode = '22023';
  end if;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
  ) values (
    intent.tour_id, p_user_id, 'owner', 'upload_completed', 'upload_authorized', 'uploaded',
    jsonb_build_object('completedAfterAuthorizationExpiry', intent.expires_at <= now())
  );

  return intent.tour_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

revoke all on function public.complete_tour_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_tour_upload(uuid, uuid) to service_role;

