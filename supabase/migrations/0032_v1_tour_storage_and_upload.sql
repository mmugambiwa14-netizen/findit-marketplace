-- 0032_v1_tour_storage_and_upload.sql
-- Private source-video storage and idempotent, service-mediated upload intents.
-- Large bytes upload directly to Storage using a short-lived signed upload URL;
-- they never pass through the application server or an Edge Function body.

create table public.listing_tour_upload_intents (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  tour_id uuid not null unique references public.listing_tours(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_storage_path text not null unique,
  original_filename text check (original_filename is null or length(original_filename) between 1 and 255),
  declared_mime_type text not null check (
    declared_mime_type in ('video/mp4', 'video/quicktime', 'video/webm')
  ),
  declared_byte_size bigint not null check (declared_byte_size between 1 and 262144000),
  declared_duration_seconds numeric(7,3) not null check (
    declared_duration_seconds between 0.001 and 120
  ),
  sha256_hex text check (sha256_hex is null or sha256_hex ~ '^[0-9a-f]{64}$'),
  state text not null default 'authorized' check (
    state in ('authorized', 'uploaded', 'processing', 'completed', 'rejected', 'cleanup_pending', 'cleanup_failed', 'cleaned')
  ),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  cleanup_claimed_at timestamptz,
  cleanup_retry_at timestamptz,
  cleanup_attempts integer not null default 0 check (cleanup_attempts between 0 and 20),
  cleanup_error_code text check (
    cleanup_error_code is null or cleanup_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  cleaned_at timestamptz,
  constraint listing_tour_upload_intents_user_idempotency unique (user_id, idempotency_key),
  constraint listing_tour_upload_intents_path check (
    source_storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/source/[0-9a-f-]{36}\.(mp4|mov|webm)$'
  ),
  constraint listing_tour_upload_intents_cleanup_consistency check (
    (state = 'cleanup_pending' and cleanup_claimed_at is not null)
    or (state <> 'cleanup_pending' and cleanup_claimed_at is null)
  )
);

create index idx_listing_tour_upload_intents_user_created
  on public.listing_tour_upload_intents(user_id, created_at desc);
create index idx_listing_tour_upload_intents_expiry
  on public.listing_tour_upload_intents(expires_at, cleanup_retry_at)
  where state in ('authorized', 'uploaded', 'rejected', 'cleanup_pending');

alter table public.listing_tour_upload_intents enable row level security;
create policy "listing_tour_upload_intents_owner_admin_read"
  on public.listing_tour_upload_intents for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.listing_tour_upload_intents from anon, authenticated;
grant select on table public.listing_tour_upload_intents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tour-sources',
  'tour-sources',
  false,
  262144000,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_active_tour_upload_intent(p_storage_path text)
returns boolean as $$
  select exists (
    select 1
    from public.listing_tour_upload_intents i
    where i.user_id = auth.uid()
      and i.source_storage_path = p_storage_path
      and i.state = 'authorized'
      and i.expires_at > now()
  );
$$ language sql stable security definer set search_path = public;

revoke all on function public.has_active_tour_upload_intent(text) from public, anon;
grant execute on function public.has_active_tour_upload_intent(text) to authenticated;

create policy "tour_source_authorized_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'tour-sources'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_active_tour_upload_intent(name)
  );

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
    if existing_intent.state = 'authorized' and existing_intent.expires_at > now() then
      return query select existing_intent.id, existing_intent.tour_id,
        existing_intent.source_storage_path, existing_intent.expires_at;
      return;
    end if;
    raise exception 'Tour upload idempotency key is no longer active' using errcode = '22023';
  end if;

  expected_owner := public.resolve_tour_parent_owner(p_listing_id, p_service_id);
  if expected_owner <> p_user_id then
    raise exception 'Tour upload requires parent ownership' using errcode = '42501';
  end if;

  if p_listing_id is not null and not exists (
    select 1 from public.listings
    where id = p_listing_id
      and seller_id = p_user_id
      and status in ('draft', 'available', 'under_offer')
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
  set status = 'uploaded', uploaded_at = now(), failure_code = null, failure_message = null
  where id = intent.tour_id and status = 'upload_authorized';

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status
  ) values (
    intent.tour_id, p_user_id, 'owner', 'upload_completed', 'upload_authorized', 'uploaded'
  );

  return intent.tour_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

revoke all on function public.authorize_tour_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) from public, anon, authenticated;
revoke all on function public.complete_tour_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.authorize_tour_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) to service_role;
grant execute on function public.complete_tour_upload(uuid, uuid) to service_role;
