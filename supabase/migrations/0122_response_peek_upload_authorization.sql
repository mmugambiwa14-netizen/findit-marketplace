-- 0122_response_peek_upload_authorization.sql
-- Extend the existing Peek media pipeline for Response Peeks without using or
-- replacing the single Main Listing Peek slot.

create or replace function public.authorize_response_peek_upload(
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
returns table (
  intent_id uuid,
  tour_id uuid,
  source_storage_path text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'storage'
as $function$
declare
  expected_owner uuid;
  existing_intent public.listing_tour_upload_intents%rowtype;
  new_intent_id uuid;
  new_expiry timestamptz := now() + interval '30 minutes';
  extension text;
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;
  if p_user_id is null or p_tour_id is null or p_idempotency_key is null then
    raise exception 'user, Peek, and idempotency identifiers are required' using errcode = '22023';
  end if;
  if ((p_listing_id is not null)::integer + (p_service_id is not null)::integer) <> 1 then
    raise exception 'exactly one Response Peek parent is required' using errcode = '22023';
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
      raise exception 'Peek upload idempotency key is no longer active' using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.listing_tours existing_tour
      where existing_tour.id = existing_intent.tour_id
        and existing_tour.owner_id = p_user_id
        and existing_tour.listing_id is not distinct from p_listing_id
        and existing_tour.service_id is not distinct from p_service_id
        and existing_tour.peek_kind = 'response'
        and existing_tour.status = 'upload_authorized'
    ) or existing_intent.declared_mime_type is distinct from p_declared_mime_type
      or existing_intent.declared_byte_size is distinct from p_declared_byte_size
      or existing_intent.declared_duration_seconds is distinct from p_declared_duration_seconds
      or existing_intent.sha256_hex is distinct from lower(p_sha256_hex) then
      raise exception 'Peek upload idempotency key does not match this response upload' using errcode = '22023';
    end if;

    expected_owner := public.resolve_tour_parent_owner(p_listing_id, p_service_id);
    if expected_owner <> p_user_id then
      raise exception 'Response Peek upload requires parent ownership' using errcode = '42501';
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
        jsonb_build_object('intentId', existing_intent.id, 'expiresAt', new_expiry, 'peekKind', 'response')
      );
      existing_intent.expires_at := new_expiry;
    end if;

    return query select existing_intent.id, existing_intent.tour_id,
      existing_intent.source_storage_path, existing_intent.expires_at;
    return;
  end if;

  expected_owner := public.resolve_tour_parent_owner(p_listing_id, p_service_id);
  if expected_owner <> p_user_id then
    raise exception 'Response Peek upload requires parent ownership' using errcode = '42501';
  end if;

  if p_listing_id is not null and not exists (
    select 1 from public.listings
    where id = p_listing_id
      and seller_id = p_user_id
      and status in ('available', 'under_offer', 'paused')
  ) then
    raise exception 'listing is not eligible for a Response Peek' using errcode = '42501';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services
    where id = p_service_id
      and provider_id = p_user_id
      and category <> 'legal'
      and status = 'active'
  ) then
    raise exception 'service is not eligible for a Response Peek' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.peek_requests r
    where r.listing_id is not distinct from p_listing_id
      and r.service_id is not distinct from p_service_id
      and r.status = 'pending'
      and r.moderation_status = 'approved'
      and r.merged_into_id is null
  ) then
    raise exception 'no eligible Buyer Peek Requests exist for this parent' using errcode = '22023';
  end if;

  if p_declared_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm')
    or p_declared_byte_size not between 1 and 262144000
    or p_declared_duration_seconds not between 0.001 and 120
    or (p_sha256_hex is not null and lower(p_sha256_hex) !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid Response Peek source metadata' using errcode = '22023';
  end if;

  extension := case p_declared_mime_type
    when 'video/mp4' then 'mp4'
    when 'video/quicktime' then 'mov'
    when 'video/webm' then 'webm'
  end;
  if p_source_storage_path !~ (
    '^' || p_user_id::text || '/' || p_tour_id::text || '/source/[0-9a-f-]{36}\.' || extension || '$'
  ) then
    raise exception 'invalid Response Peek source path' using errcode = '22023';
  end if;

  if (
    select count(*) from public.listing_tour_upload_intents
    where user_id = p_user_id and created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Peek upload rate exceeded' using errcode = 'P0001';
  end if;

  insert into public.listing_tours (
    id, owner_id, listing_id, service_id, peek_kind, source_storage_path,
    status, moderation_status, mime_type, source_byte_size, checksum_sha256
  ) values (
    p_tour_id, p_user_id, p_listing_id, p_service_id, 'response', p_source_storage_path,
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

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
  ) values (
    p_tour_id, p_user_id, 'owner', 'upload_authorized', 'created', 'upload_authorized',
    jsonb_build_object('intentId', new_intent_id, 'expiresAt', new_expiry, 'peekKind', 'response')
  );

  return query select new_intent_id, p_tour_id, p_source_storage_path, new_expiry;
end;
$function$;

revoke all on function public.authorize_response_peek_upload(uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid) from public;

comment on function public.authorize_response_peek_upload(uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid) is
  'Authorizes a Response Peek through the existing private upload and processing pipeline without touching the Main Peek slot.';

create or replace function public.promote_approved_tour(p_tour_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  candidate public.listing_tours%rowtype;
  slot_row public.listing_tour_slots%rowtype;
  previous_tour_id uuid;
begin
  select * into candidate from public.listing_tours
  where id = p_tour_id for update;
  if not found then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  if candidate.status <> 'ready'
    or candidate.moderation_status <> 'approved'
    or candidate.deleted_at is not null then
    raise exception 'Tour is not eligible for promotion' using errcode = '22023';
  end if;

  if not public.is_tour_parent_public(candidate.listing_id, candidate.service_id) then
    raise exception 'Tour parent is not publicly available' using errcode = '22023';
  end if;

  if candidate.peek_kind = 'response' then
    update public.listing_tours
    set published_at = coalesce(published_at, now())
    where id = candidate.id;

    insert into public.listing_tour_events (
      tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
    ) values (
      candidate.id, auth.uid(),
      case when public.is_admin() then 'admin' else 'system' end,
      'response_peek_published', 'ready', 'ready',
      jsonb_build_object('peekKind', 'response')
    );
    return candidate.id;
  end if;

  select * into slot_row from public.listing_tour_slots
  where pending_tour_id = candidate.id for update;
  if not found then
    if exists (
      select 1 from public.listing_tour_slots where current_tour_id = candidate.id
    ) then
      update public.listing_tours
      set published_at = coalesce(published_at, now())
      where id = candidate.id;
      insert into public.listing_tour_events (
        tour_id, actor_id, actor_type, event_type, previous_status, next_status
      ) values (
        candidate.id, auth.uid(),
        case when public.is_admin() then 'admin' else 'system' end,
        'tour_republished', 'ready', 'ready'
      );
      return candidate.id;
    end if;
    raise exception 'Tour is not the pending version for its parent' using errcode = '22023';
  end if;

  previous_tour_id := slot_row.current_tour_id;
  update public.listing_tour_slots
  set current_tour_id = candidate.id, pending_tour_id = null
  where id = slot_row.id;

  update public.listing_tours
  set published_at = coalesce(published_at, now())
  where id = candidate.id;

  if previous_tour_id is not null and previous_tour_id <> candidate.id then
    update public.listing_tours
    set status = 'superseded', superseded_at = now(), published_at = null
    where id = previous_tour_id;

    insert into public.listing_tour_events (
      tour_id, actor_type, event_type, previous_status, next_status, metadata
    ) values (
      previous_tour_id, 'system', 'tour_superseded', 'ready', 'superseded',
      jsonb_build_object('replacementTourId', candidate.id)
    );
  end if;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
  ) values (
    candidate.id, auth.uid(),
    case when public.is_admin() then 'admin' else 'system' end,
    'tour_promoted', 'ready', 'ready',
    jsonb_build_object('previousTourId', previous_tour_id)
  );
  return candidate.id;
end;
$function$;
