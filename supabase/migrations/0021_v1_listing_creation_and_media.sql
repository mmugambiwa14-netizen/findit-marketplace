-- 0021_v1_listing_creation_and_media.sql
-- Replaces Base44 product-listing creation and listing-image upload contracts.
-- New product adverts are created atomically in pending_review and can become
-- public only through protected moderation. Storage objects remain private;
-- signed reads are authorized through listing ownership/publication state.

alter table public.listings
  add column submission_key uuid,
  add column submitted_at timestamptz,
  add column moderation_reason text;

create unique index idx_listings_submission_key
  on public.listings(submission_key) where submission_key is not null;
create index idx_listings_moderation_queue
  on public.listings(status, submitted_at desc)
  where status = 'pending_review';

create table public.listing_upload_intents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  storage_path  text not null unique,
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size     integer not null check (byte_size between 1 and 5242880),
  width_px      integer not null check (width_px between 1 and 8000),
  height_px     integer not null check (height_px between 1 and 8000),
  sha256_hex    text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  state         text not null default 'validated'
                check (state in ('validated', 'uploaded', 'attached', 'rejected')),
  expires_at    timestamptz not null default (now() + interval '20 minutes'),
  created_at    timestamptz not null default now(),
  uploaded_at   timestamptz,
  attached_at   timestamptz,
  check ((width_px::bigint * height_px::bigint) <= 40000000),
  check (storage_path ~ '^[0-9a-f-]{36}/staging/[0-9a-f-]{36}\.(jpg|png|webp)$')
);

create index idx_listing_upload_intents_user_created
  on public.listing_upload_intents(user_id, created_at desc);
create index idx_listing_upload_intents_expiry
  on public.listing_upload_intents(expires_at)
  where state in ('validated', 'uploaded');

create table public.listing_media (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  owner_id      uuid not null references public.users(id) on delete cascade,
  storage_path  text not null unique,
  display_order integer not null check (display_order between 0 and 19),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size     integer not null check (byte_size between 1 and 5242880),
  width_px      integer not null check (width_px between 1 and 8000),
  height_px     integer not null check (height_px between 1 and 8000),
  sha256_hex    text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  unique (listing_id, display_order),
  check ((width_px::bigint * height_px::bigint) <= 40000000)
);

create index idx_listing_media_listing_order
  on public.listing_media(listing_id, display_order);

alter table public.listing_upload_intents enable row level security;
alter table public.listing_media enable row level security;

-- Upload intents are a server-only authorization ledger. Product media rows
-- are visible only with the same owner/admin/publication boundary as listings.
create policy "listing_media_read" on public.listing_media
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('available', 'under_offer', 'rented')
    )
  );

revoke all on table public.listing_upload_intents from anon, authenticated;
revoke insert, update, delete on table public.listing_media from anon, authenticated;
grant select on table public.listing_media to anon, authenticated;

-- Bucket restrictions are duplicated in config.toml for local parity and in
-- the database so hosted environments receive the same limits on db push.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images', 'listing-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Minimum authoritative launch geography. Production imports may add finer
-- areas later, but listing creation never falls back to an unowned text value.
insert into public.locations (id, name, type, parent_id, country_code, latitude, longitude, timezone)
values
  ('00000000-0000-4000-8000-000000000001', 'Zimbabwe', 'country', null, 'ZW', -19.015438, 29.154857, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000101', 'Harare', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -17.825166, 31.033510, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000102', 'Bulawayo', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -20.132507, 28.626479, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000103', 'Mutare', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -18.970700, 32.670900, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000104', 'Gweru', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -19.450000, 29.816700, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000105', 'Masvingo', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -20.074400, 30.832800, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000106', 'Victoria Falls', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -17.924300, 25.857200, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000107', 'Chinhoyi', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -17.366700, 30.200000, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000108', 'Marondera', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -18.185300, 31.551900, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000109', 'Kadoma', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -18.333300, 29.916700, 'Africa/Harare'),
  ('00000000-0000-4000-8000-000000000110', 'Kariba', 'city', '00000000-0000-4000-8000-000000000001', 'ZW', -16.516700, 28.800000, 'Africa/Harare')
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  parent_id = excluded.parent_id,
  country_code = excluded.country_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  is_active = true;

create or replace function public.has_valid_listing_upload_intent(p_storage_path text)
returns boolean as $$
  select exists (
    select 1 from public.listing_upload_intents i
    where i.user_id = auth.uid()
      and i.storage_path = p_storage_path
      and i.state = 'validated'
      and i.expires_at > now()
  );
$$ language sql stable security definer set search_path = public;

revoke all on function public.has_valid_listing_upload_intent(text) from public;
grant execute on function public.has_valid_listing_upload_intent(text) to authenticated;

create policy "listing_image_validated_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'listing-images'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_valid_listing_upload_intent(name)
  );

create policy "listing_image_authorized_read" on storage.objects
  for select to public using (
    bucket_id = 'listing-images'
    and (
      owner_id = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1
        from public.listing_media m
        join public.listings l on l.id = m.listing_id
        where m.storage_path = name
          and l.status in ('available', 'under_offer', 'rented')
      )
    )
  );

create policy "listing_image_owner_delete_unpublished" on storage.objects
  for delete to authenticated using (
    bucket_id = 'listing-images'
    and owner_id = auth.uid()::text
    and not exists (select 1 from public.listing_media m where m.storage_path = name)
  );

create or replace function public.authorize_listing_image_upload(
  p_user_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width_px integer,
  p_height_px integer,
  p_sha256_hex text
)
returns uuid as $$
declare
  intent_id uuid;
begin
  if not exists (select 1 from public.users where id = p_user_id and status = 'active') then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_storage_path !~ ('^' || p_user_id::text || '/staging/[0-9a-f-]{36}\.(jpg|png|webp)$')
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 5242880
    or p_width_px not between 1 and 8000
    or p_height_px not between 1 and 8000
    or (p_width_px::bigint * p_height_px::bigint) > 40000000
    or p_sha256_hex !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  if (
    select count(*) from public.listing_upload_intents
    where user_id = p_user_id and created_at >= now() - interval '1 hour'
  ) >= 60 then
    raise exception 'listing image upload rate exceeded' using errcode = 'P0001';
  end if;

  insert into public.listing_upload_intents (
    user_id, storage_path, mime_type, byte_size, width_px, height_px, sha256_hex
  ) values (
    p_user_id, p_storage_path, p_mime_type, p_byte_size,
    p_width_px, p_height_px, lower(p_sha256_hex)
  ) returning id into intent_id;
  return intent_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.complete_listing_image_upload(p_intent_id uuid)
returns void as $$
declare
  intent public.listing_upload_intents%rowtype;
begin
  select * into intent from public.listing_upload_intents
  where id = p_intent_id and state = 'validated' and expires_at > now()
  for update;
  if not found then
    raise exception 'upload authorization is invalid or expired' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'listing-images'
      and o.name = intent.storage_path
      and o.owner_id = intent.user_id::text
      and o.metadata ->> 'mimetype' = intent.mime_type
      and (o.metadata ->> 'size')::integer = intent.byte_size
  ) then
    raise exception 'uploaded object does not match its authorization' using errcode = 'P0002';
  end if;
  update public.listing_upload_intents
  set state = 'uploaded', uploaded_at = now(), expires_at = now() + interval '7 days'
  where id = p_intent_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.create_v1_listing_submission(
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_media jsonb
)
returns jsonb as $$
declare
  actor public.users%rowtype;
  existing public.listings%rowtype;
  created public.listings%rowtype;
  normalized_kind public.listing_kind;
  normalized_title text := trim(coalesce(p_listing ->> 'title', ''));
  normalized_description text := trim(coalesce(p_listing ->> 'description', ''));
  normalized_category text := trim(coalesce(p_listing ->> 'category', ''));
  normalized_offer text := trim(coalesce(p_listing ->> 'listingType', ''));
  normalized_phone text := nullif(trim(coalesce(p_listing ->> 'contactPhone', '')), '');
  normalized_whatsapp text := nullif(trim(coalesce(p_listing ->> 'contactWhatsapp', '')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_listing ->> 'contactEmail', ''))), '');
  normalized_price numeric;
  normalized_location uuid;
  media_count integer;
  media_item jsonb;
  media_intent public.listing_upload_intents%rowtype;
  media_paths jsonb := '[]'::jsonb;
  media_index integer := 0;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_submission_key is null then
    raise exception 'submission key is required' using errcode = '22023';
  end if;

  select * into existing from public.listings where submission_key = p_submission_key;
  if found then
    if existing.seller_id <> auth.uid() then
      raise exception 'submission key already used' using errcode = '23505';
    end if;
    return jsonb_build_object('id', existing.id, 'kind', existing.kind, 'status', existing.status);
  end if;

  select * into actor from public.users where id = auth.uid() and status = 'active';
  normalized_kind := (p_listing ->> 'kind')::public.listing_kind;
  normalized_price := (p_listing ->> 'price')::numeric;
  normalized_location := (p_listing ->> 'locationId')::uuid;
  media_count := jsonb_array_length(coalesce(p_media, '[]'::jsonb));

  if length(normalized_title) not between 10 and 160
    or length(normalized_description) not between 50 and 5000
    or normalized_price <= 0 or normalized_price > 999999999999.99
    or coalesce(p_listing ->> 'currency', '') <> 'USD'
    or normalized_offer not in ('sale', 'rent')
    or normalized_category !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
    or length(coalesce(normalized_phone, '')) > 40
    or length(coalesce(normalized_whatsapp, '')) > 40
    or length(coalesce(normalized_email, '')) > 254
    or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (normalized_phone is null and normalized_whatsapp is null and normalized_email is null)
    or media_count not between 1 and 20
  then
    raise exception 'invalid V1 listing submission' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.categories c
    where c.slug = normalized_category and c.marketplace_kind = normalized_kind::text
      and c.parent_id is not null and c.is_active
  ) then
    raise exception 'active listing category not found' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.locations l
    where l.id = normalized_location and l.country_code = 'ZW' and l.is_active
  ) then
    raise exception 'active Zimbabwe location not found' using errcode = '22023';
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    select * into media_intent
    from public.listing_upload_intents
    where id = (media_item ->> 'intentId')::uuid
      and user_id = auth.uid()
      and storage_path = media_item ->> 'path'
      and state = 'uploaded'
      and expires_at > now()
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'listing-images'
          and o.name = listing_upload_intents.storage_path
          and o.owner_id = listing_upload_intents.user_id::text
          and o.metadata ->> 'mimetype' = listing_upload_intents.mime_type
          and (o.metadata ->> 'size')::integer = listing_upload_intents.byte_size
      )
    for update;
    if not found then
      raise exception 'listing image is invalid, expired, or already attached' using errcode = '22023';
    end if;
    if media_paths ? media_intent.storage_path then
      raise exception 'duplicate listing image' using errcode = '22023';
    end if;
    media_paths := media_paths || jsonb_build_array(media_intent.storage_path);
  end loop;

  insert into public.listings (
    kind, seller_id, seller_name, contact_phone, contact_whatsapp, contact_email,
    title, description, price, currency, accepts_offers, photos, location_id,
    category, listing_type, status, created_via, verified, submission_key,
    submitted_at, moderation_reason
  ) values (
    normalized_kind, auth.uid(), coalesce(nullif(trim(actor.full_name), ''), actor.email),
    normalized_phone, normalized_whatsapp, normalized_email,
    normalized_title, normalized_description, normalized_price, 'USD',
    coalesce((p_listing ->> 'negotiable')::boolean, false), media_paths,
    normalized_location, normalized_category, normalized_offer,
    'pending_review', 'single', false, p_submission_key, now(), null
  ) returning * into created;

  if normalized_kind = 'property' then
    insert into public.property_details (
      listing_id, property_type, bedrooms, bathrooms, size_sqm
    ) values (
      created.id,
      coalesce(nullif(p_detail ->> 'propertyType', ''), 'other')::public.property_type,
      nullif(p_detail ->> 'bedrooms', '')::integer,
      nullif(p_detail ->> 'bathrooms', '')::integer,
      nullif(p_detail ->> 'sizeSqm', '')::numeric
    );
  elsif normalized_kind = 'car' then
    insert into public.car_details (
      listing_id, brand, model, year, mileage, fuel_type, transmission, condition
    ) values (
      created.id, nullif(trim(p_detail ->> 'brand'), ''), nullif(trim(p_detail ->> 'model'), ''),
      nullif(p_detail ->> 'year', '')::integer, nullif(p_detail ->> 'mileage', '')::integer,
      nullif(p_detail ->> 'fuelType', '')::public.car_fuel_type,
      nullif(p_detail ->> 'transmission', '')::public.car_transmission,
      nullif(lower(trim(p_detail ->> 'condition')), '')
    );
  else
    insert into public.machinery_details (
      listing_id, machinery_type, brand, model, condition, year, usage_hours
    ) values (
      created.id,
      coalesce(nullif(p_detail ->> 'machineryType', ''), 'other')::public.machinery_type,
      nullif(trim(p_detail ->> 'brand'), ''), nullif(trim(p_detail ->> 'model'), ''),
      coalesce(nullif(p_detail ->> 'condition', ''), 'good')::public.machinery_condition,
      nullif(p_detail ->> 'year', '')::integer,
      nullif(p_detail ->> 'usageHours', '')::integer
    );
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    select * into media_intent from public.listing_upload_intents
    where id = (media_item ->> 'intentId')::uuid for update;
    insert into public.listing_media (
      listing_id, owner_id, storage_path, display_order, mime_type,
      byte_size, width_px, height_px, sha256_hex
    ) values (
      created.id, auth.uid(), media_intent.storage_path, media_index,
      media_intent.mime_type, media_intent.byte_size, media_intent.width_px,
      media_intent.height_px, media_intent.sha256_hex
    );
    update public.listing_upload_intents
    set state = 'attached', attached_at = now()
    where id = media_intent.id;
    media_index := media_index + 1;
  end loop;

  return jsonb_build_object('id', created.id, 'kind', created.kind, 'status', created.status);
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb as $$
declare
  listing_row public.listings%rowtype;
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_action not in ('submit', 'pause', 'resume', 'unavailable') then
    raise exception 'invalid owner listing action' using errcode = '22023';
  end if;
  select * into listing_row from public.listings
  where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and listing_row.status in ('draft', 'rejected', 'expired', 'unavailable') then
    if not exists (select 1 from public.listing_media where listing_id = p_listing_id) then
      raise exception 'at least one validated image is required' using errcode = '22023';
    end if;
    next_status := 'pending_review';
  elsif p_action = 'pause' and listing_row.status in ('available', 'under_offer', 'rented') then
    next_status := 'paused';
  elsif p_action = 'resume' and listing_row.status = 'paused' then
    next_status := 'available';
  elsif p_action = 'unavailable' and listing_row.status in ('available', 'under_offer', 'rented', 'paused') then
    next_status := 'unavailable';
  else
    raise exception 'listing action is not allowed from the current status' using errcode = '22023';
  end if;

  update public.listings
  set status = next_status,
      submitted_at = case when next_status = 'pending_review' then now() else submitted_at end,
      moderation_reason = case when next_status = 'pending_review' then null else moderation_reason end,
      expires_at = case when next_status = 'pending_review' then null else expires_at end,
      expiry_notice_sent_at = case when next_status = 'pending_review' then null else expiry_notice_sent_at end
  where id = p_listing_id
  returning * into listing_row;
  return jsonb_build_object('id', listing_row.id, 'kind', listing_row.kind, 'status', listing_row.status);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.protect_listing_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.seller_id and not public.is_admin() and current_user not in ('postgres', 'service_role') then
    if new.id is distinct from old.id
      or new.kind is distinct from old.kind
      or new.seller_id is distinct from old.seller_id
      or new.status is distinct from old.status
      or new.verified is distinct from old.verified
      or new.views is distinct from old.views
      or new.created_via is distinct from old.created_via
      or new.created_at is distinct from old.created_at
      or new.submission_key is distinct from old.submission_key
      or new.submitted_at is distinct from old.submitted_at
      or new.moderation_reason is distinct from old.moderation_reason
      or new.expires_at is distinct from old.expires_at
      or new.expiry_notice_sent_at is distinct from old.expiry_notice_sent_at
    then
      raise exception 'listing-managed fields require a trusted operation'
        using errcode = '42501';
    end if;
    if old.status in ('available', 'under_offer', 'rented', 'paused') and (
      new.seller_name is distinct from old.seller_name
      or new.contact_phone is distinct from old.contact_phone
      or new.contact_whatsapp is distinct from old.contact_whatsapp
      or new.contact_email is distinct from old.contact_email
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.price is distinct from old.price
      or new.currency is distinct from old.currency
      or new.accepts_offers is distinct from old.accepts_offers
      or new.photos is distinct from old.photos
      or new.location_id is distinct from old.location_id
      or new.category is distinct from old.category
      or new.listing_type is distinct from old.listing_type
    ) then
      new.status := 'pending_review';
      new.submitted_at := now();
      new.moderation_reason := null;
      new.expires_at := null;
      new.expiry_notice_sent_at := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

-- Product moderation now respects the explicit queue/rejection/pause states.
create or replace function public.admin_moderate_marketplace_item(
  p_item_id uuid,
  p_kind text,
  p_action text,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
  correlation uuid := gen_random_uuid();
  target_owner uuid;
  target_title text;
  current_listing_status public.listing_status;
begin
  if p_kind not in ('property', 'car', 'machinery', 'service')
    or p_action not in ('publish', 'pause', 'reject', 'remove')
  then
    raise exception 'invalid moderation operation' using errcode = '22023';
  end if;
  if p_kind = 'service' and p_action = 'reject' then
    raise exception 'service rejection is not supported by the V1 notification contract' using errcode = '22023';
  end if;

  if p_kind = 'service' then
    select to_jsonb(s) into before_row from public.services s
    where s.id = p_item_id and s.category <> 'legal' for update;
    if before_row is null then raise exception 'marketplace item not found' using errcode = 'P0002'; end if;
    if p_action = 'remove' then
      delete from public.services where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    else
      update public.services
      set status = case when p_action = 'publish' then 'active'::public.service_status else 'paused'::public.service_status end
      where id = p_item_id returning to_jsonb(public.services.*) into after_row;
    end if;
  else
    select to_jsonb(l), l.seller_id, l.title, l.status
      into before_row, target_owner, target_title, current_listing_status
    from public.listings l
    where l.id = p_item_id and l.kind::text = p_kind for update;
    if before_row is null then raise exception 'marketplace item not found' using errcode = 'P0002'; end if;

    if p_action = 'remove' then
      update public.reports set status = 'actioned', admin_notes = normalized_reason,
        reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = p_item_id and status in ('pending', 'reviewed');
      update public.reports set listing_id = null where listing_id = p_item_id;
      delete from public.listings where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    elsif p_action = 'publish' and current_listing_status = 'pending_review' then
      update public.listings
      set status = 'available', moderation_reason = null
      where id = p_item_id returning to_jsonb(public.listings.*) into after_row;
    elsif p_action = 'reject' and current_listing_status = 'pending_review' then
      update public.listings
      set status = 'rejected', moderation_reason = normalized_reason,
          expires_at = null, expiry_notice_sent_at = null
      where id = p_item_id returning to_jsonb(public.listings.*) into after_row;
    elsif p_action = 'pause' and current_listing_status in ('available', 'under_offer', 'rented') then
      update public.listings set status = 'paused'
      where id = p_item_id returning to_jsonb(public.listings.*) into after_row;
    else
      raise exception 'moderation action is not allowed from the current status' using errcode = '22023';
    end if;

    if p_action in ('publish', 'reject') then
      perform public.create_essential_notification(
        target_owner,
        case when p_action = 'publish' then 'listing_approved' else 'listing_rejected' end,
        'moderation:' || correlation::text,
        case when p_action = 'publish' then 'Listing approved' else 'Listing rejected' end,
        case when p_action = 'publish'
          then target_title || ' is now live on FindIt.'
          else target_title || ' was not approved. Reason: ' || normalized_reason end,
        '/my-listings', p_item_id
      );
    end if;
  end if;

  perform public.record_admin_action(
    'marketplace.' || p_action, p_item_id::text, p_kind, normalized_reason,
    before_row, after_row, correlation
  );
  return after_row || jsonb_build_object('correlation_id', correlation);
end;
$$ language plpgsql security definer set search_path = public;

-- Product creation is RPC-only so callers cannot choose seller, status,
-- verification, source, counters, moderation fields, or incomplete detail rows.
revoke insert on table public.listings from anon, authenticated;
revoke insert, update on table public.car_details from anon, authenticated;
revoke insert, update on table public.property_details from anon, authenticated;
revoke insert, update on table public.machinery_details from anon, authenticated;

revoke all on function public.authorize_listing_image_upload(uuid, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.complete_listing_image_upload(uuid) from public, anon, authenticated;
revoke all on function public.create_v1_listing_submission(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.owner_transition_listing(uuid, text) from public;

grant execute on function public.authorize_listing_image_upload(uuid, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.complete_listing_image_upload(uuid) to service_role;
grant execute on function public.create_v1_listing_submission(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.owner_transition_listing(uuid, text) to authenticated;
