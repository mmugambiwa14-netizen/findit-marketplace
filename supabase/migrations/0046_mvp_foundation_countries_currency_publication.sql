-- 0046_mvp_foundation_countries_currency_publication.sql
-- MVP foundation amendments:
-- - countries become configured markets instead of a hard-coded Zimbabwe-only rule;
-- - listing price stores seller-native currency alongside compatibility columns;
-- - listing creation auto-publishes after technical validation;
-- - public/private location fields are separated for later Maps/PostGIS work;
-- - expiry is preserved but explicitly muted by an operational control.
--
-- Rollback strategy:
-- - disable writes through the app, then restore create_v1_listing_submission and
--   owner_transition_listing from migration 0021 if manual review must be restored;
-- - keep additive tables/columns in place until dependent deployed code has rolled
--   back, then drop country/currency/location tables and columns in reverse order.

create extension if not exists postgis with schema extensions;

alter type public.location_type add value if not exists 'region';
alter type public.location_type add value if not exists 'county';
alter type public.location_type add value if not exists 'suburb';
alter type public.location_type add value if not exists 'neighbourhood';
alter type public.location_type add value if not exists 'village';

alter type public.service_pricing_type add value if not exists 'daily';
alter type public.service_pricing_type add value if not exists 'quote_required';
alter type public.service_pricing_type add value if not exists 'contact_for_price';

do $$
begin
  create type public.country_operational_state as enum ('active', 'browse_only', 'unavailable');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.location_visibility_mode as enum ('exact', 'approximate', 'city_only');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.location_source as enum ('canonical', 'provider', 'device', 'map_pin', 'manual');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.service_delivery_mode as enum ('fixed_location', 'travels_to_customer', 'remote', 'fixed_and_mobile');
exception when duplicate_object then null;
end $$;

create table if not exists public.country_configs (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  operational_state public.country_operational_state not null default 'unavailable',
  supported_listing_currencies text[] not null default array['USD'],
  default_listing_currency text not null default 'USD',
  default_display_currency text not null default 'USD',
  currency_precision jsonb not null default '{}'::jsonb,
  currency_notices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (default_listing_currency = any(supported_listing_currencies)),
  check (default_display_currency <> '')
);

create trigger trg_country_configs_updated_at
  before update on public.country_configs
  for each row execute function public.set_updated_at();

insert into public.country_configs (
  country_code, country_name, operational_state, supported_listing_currencies,
  default_listing_currency, default_display_currency, currency_precision, currency_notices
) values (
  'ZW',
  'Zimbabwe',
  'active',
  array['USD', 'ZWL', 'ZAR'],
  'USD',
  'USD',
  '{"USD":0,"ZWL":0,"ZAR":0}'::jsonb,
  '{"USD":"US dollar prices are seller-native unless marked approximate.","ZWL":"Confirm accepted payment method with the seller.","ZAR":"Confirm accepted payment method with the seller."}'::jsonb
)
on conflict (country_code) do update set
  country_name = excluded.country_name,
  operational_state = excluded.operational_state,
  supported_listing_currencies = excluded.supported_listing_currencies,
  default_listing_currency = excluded.default_listing_currency,
  default_display_currency = excluded.default_display_currency,
  currency_precision = excluded.currency_precision,
  currency_notices = excluded.currency_notices,
  updated_at = now();

alter table public.locations
  add column if not exists provider_name text,
  add column if not exists provider_place_id text,
  add column if not exists administrative_labels jsonb not null default '{}'::jsonb,
  add column if not exists locality_labels jsonb not null default '{}'::jsonb,
  add column if not exists source public.location_source not null default 'canonical',
  add column if not exists accuracy text,
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by uuid references public.users(id);

create unique index if not exists idx_locations_provider_identity
  on public.locations(provider_name, provider_place_id)
  where provider_name is not null and provider_place_id is not null;
create index if not exists idx_locations_country_type_active
  on public.locations(country_code, type, is_active, name);

alter table public.listings
  add column if not exists country_code text,
  add column if not exists native_price numeric(14,2),
  add column if not exists native_currency text,
  add column if not exists public_latitude numeric(9,6),
  add column if not exists public_longitude numeric(9,6),
  add column if not exists public_location_label text,
  add column if not exists location_visibility public.location_visibility_mode not null default 'approximate',
  add column if not exists public_location extensions.geography(Point, 4326),
  add column if not exists content_suspended_at timestamptz,
  add column if not exists content_suspension_reason text;

update public.listings l
set
  country_code = coalesce(l.country_code, loc.country_code, 'ZW'),
  native_price = coalesce(l.native_price, l.price),
  native_currency = coalesce(nullif(l.native_currency, ''), nullif(l.currency, ''), 'USD'),
  public_latitude = coalesce(l.public_latitude, l.latitude, loc.latitude),
  public_longitude = coalesce(l.public_longitude, l.longitude, loc.longitude),
  public_location_label = coalesce(nullif(l.public_location_label, ''), loc.name),
  public_location = case
    when coalesce(l.public_longitude, l.longitude, loc.longitude) is not null
     and coalesce(l.public_latitude, l.latitude, loc.latitude) is not null
    then extensions.st_setsrid(extensions.st_makepoint(
      coalesce(l.public_longitude, l.longitude, loc.longitude)::double precision,
      coalesce(l.public_latitude, l.latitude, loc.latitude)::double precision
    ), 4326)::extensions.geography
    else l.public_location
  end
from public.locations loc
where loc.id = l.location_id
  and (l.country_code is null or l.native_price is null or l.native_currency is null or l.public_location is null);

create index if not exists idx_listings_country_public_status
  on public.listings(country_code, kind, status, created_at desc, id desc)
  where status in ('available', 'under_offer');
create index if not exists idx_listings_public_location_gist
  on public.listings using gist(public_location)
  where public_location is not null and status in ('available', 'under_offer');

create table if not exists public.listing_private_locations (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  exact_latitude numeric(9,6),
  exact_longitude numeric(9,6),
  exact_address text,
  accuracy_meters numeric(10,2),
  source public.location_source not null default 'manual',
  provider_name text,
  provider_place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_listing_private_locations_updated_at
  before update on public.listing_private_locations
  for each row execute function public.set_updated_at();

alter table public.services
  add column if not exists country_code text,
  add column if not exists base_location_id uuid references public.locations(id),
  add column if not exists delivery_mode public.service_delivery_mode not null default 'fixed_location',
  add column if not exists service_radius_km numeric(8,2),
  add column if not exists remote_available boolean not null default false,
  add column if not exists fixed_premises boolean not null default false,
  add column if not exists location_visibility public.location_visibility_mode not null default 'approximate',
  add column if not exists native_price numeric(14,2),
  add column if not exists native_currency text;

update public.services s
set
  country_code = coalesce(s.country_code, loc.country_code, 'ZW'),
  base_location_id = coalesce(s.base_location_id, s.location_id),
  delivery_mode = case
    when s.remote_available then 'remote'::public.service_delivery_mode
    when s.can_travel and s.location_id is not null then 'fixed_and_mobile'::public.service_delivery_mode
    when s.can_travel then 'travels_to_customer'::public.service_delivery_mode
    else 'fixed_location'::public.service_delivery_mode
  end,
  native_price = coalesce(s.native_price, s.price),
  native_currency = coalesce(nullif(s.native_currency, ''), nullif(s.currency, ''), 'USD')
from public.locations loc
where loc.id = s.location_id
  and (s.country_code is null or s.base_location_id is null or s.native_price is null or s.native_currency is null);

create table if not exists public.exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric(20,8) not null check (rate > 0),
  provider text not null,
  retrieved_at timestamptz not null,
  stale_after timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, provider)
);

create table if not exists public.marketplace_operational_controls (
  control_key text primary key,
  enabled boolean not null default false,
  state text,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

insert into public.marketplace_operational_controls (control_key, enabled, state, configuration)
values
  ('listing_expiry', false, 'muted', '{"reason":"Expiry infrastructure is preserved but customer-facing expiry is muted for MVP."}'::jsonb),
  ('new_tours', true, 'enabled', '{}'::jsonb),
  ('tour_playback', true, 'enabled', '{}'::jsonb),
  ('maps', true, 'enabled', '{}'::jsonb),
  ('geocoding', true, 'enabled', '{}'::jsonb),
  ('media_uploads', true, 'enabled', '{}'::jsonb),
  ('new_accounts', true, 'enabled', '{}'::jsonb),
  ('currency_conversion', false, 'fallback_native_only', '{}'::jsonb)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

alter table public.country_configs enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.marketplace_operational_controls enable row level security;
alter table public.listing_private_locations enable row level security;

drop policy if exists "country_configs_public_read" on public.country_configs;
create policy "country_configs_public_read" on public.country_configs
  for select using (true);
drop policy if exists "country_configs_admin_write" on public.country_configs;
create policy "country_configs_admin_write" on public.country_configs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "exchange_rates_public_read" on public.exchange_rates;
create policy "exchange_rates_public_read" on public.exchange_rates
  for select using (true);
drop policy if exists "exchange_rates_admin_write" on public.exchange_rates;
create policy "exchange_rates_admin_write" on public.exchange_rates
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "marketplace_operational_controls_public_read" on public.marketplace_operational_controls;
create policy "marketplace_operational_controls_public_read" on public.marketplace_operational_controls
  for select using (true);
drop policy if exists "marketplace_operational_controls_admin_write" on public.marketplace_operational_controls;
create policy "marketplace_operational_controls_admin_write" on public.marketplace_operational_controls
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "listing_private_locations_owner_admin_read" on public.listing_private_locations;
create policy "listing_private_locations_owner_admin_read" on public.listing_private_locations
  for select using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "listing_private_locations_server_write" on public.listing_private_locations;
create policy "listing_private_locations_server_write" on public.listing_private_locations
  for all using (current_user in ('postgres', 'service_role') or public.is_admin())
  with check (current_user in ('postgres', 'service_role') or public.is_admin());

revoke insert, update, delete on table public.country_configs from anon, authenticated;
revoke insert, update, delete on table public.exchange_rates from anon, authenticated;
revoke insert, update, delete on table public.marketplace_operational_controls from anon, authenticated;
revoke all on table public.listing_private_locations from anon, authenticated;
grant select on table public.country_configs to anon, authenticated;
grant select on table public.exchange_rates to anon, authenticated;
grant select on table public.marketplace_operational_controls to anon, authenticated;
grant select on table public.listing_private_locations to authenticated;

create or replace function public.is_country_publishable(p_country_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.country_configs
    where country_code = upper(trim(coalesce(p_country_code, '')))
      and operational_state = 'active'
  );
$$;

create or replace function public.is_country_browsable(p_country_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.country_configs
    where country_code = upper(trim(coalesce(p_country_code, '')))
      and operational_state in ('active', 'browse_only')
  );
$$;

create or replace function public.is_supported_listing_currency(p_country_code text, p_currency text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.country_configs
    where country_code = upper(trim(coalesce(p_country_code, '')))
      and upper(trim(coalesce(p_currency, ''))) = any(supported_listing_currencies)
  );
$$;

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
  location_row public.locations%rowtype;
  normalized_kind public.listing_kind;
  normalized_title text := trim(coalesce(p_listing ->> 'title', ''));
  normalized_description text := trim(coalesce(p_listing ->> 'description', ''));
  normalized_category text := trim(coalesce(p_listing ->> 'category', ''));
  normalized_offer text := trim(coalesce(p_listing ->> 'listingType', ''));
  normalized_phone text := nullif(trim(coalesce(p_listing ->> 'contactPhone', '')), '');
  normalized_whatsapp text := nullif(trim(coalesce(p_listing ->> 'contactWhatsapp', '')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_listing ->> 'contactEmail', ''))), '');
  normalized_price numeric;
  normalized_currency text := upper(trim(coalesce(p_listing ->> 'currency', 'USD')));
  normalized_location uuid;
  normalized_country text;
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

  select * into location_row from public.locations
  where id = normalized_location and is_active;
  if not found then
    raise exception 'active location not found' using errcode = '22023';
  end if;
  normalized_country := upper(location_row.country_code);

  if length(normalized_title) not between 10 and 160
    or length(normalized_description) not between 50 and 5000
    or normalized_price <= 0 or normalized_price > 999999999999.99
    or normalized_currency !~ '^[A-Z]{3}$'
    or not public.is_country_publishable(normalized_country)
    or not public.is_supported_listing_currency(normalized_country, normalized_currency)
    or normalized_offer not in ('sale', 'rent')
    or normalized_category !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
    or length(coalesce(normalized_phone, '')) > 40
    or length(coalesce(normalized_whatsapp, '')) > 40
    or length(coalesce(normalized_email, '')) > 254
    or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (normalized_phone is null and normalized_whatsapp is null and normalized_email is null)
    or media_count not between 1 and 20
  then
    raise exception 'invalid listing submission' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.categories c
    where c.slug = normalized_category and c.marketplace_kind = normalized_kind::text
      and c.parent_id is not null and c.is_active
  ) then
    raise exception 'active listing category not found' using errcode = '22023';
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
    title, description, price, currency, native_price, native_currency,
    accepts_offers, photos, location_id, country_code, latitude, longitude,
    public_latitude, public_longitude, public_location_label, public_location,
    category, listing_type, status, created_via, verified, submission_key,
    submitted_at, moderation_reason, expires_at, expiry_notice_sent_at
  ) values (
    normalized_kind, auth.uid(), coalesce(nullif(trim(actor.full_name), ''), actor.email),
    normalized_phone, normalized_whatsapp, normalized_email,
    normalized_title, normalized_description, normalized_price, normalized_currency,
    normalized_price, normalized_currency,
    coalesce((p_listing ->> 'negotiable')::boolean, false), media_paths,
    normalized_location, normalized_country, location_row.latitude, location_row.longitude,
    location_row.latitude, location_row.longitude, location_row.name,
    case when location_row.longitude is not null and location_row.latitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(location_row.longitude::double precision, location_row.latitude::double precision), 4326)::extensions.geography
      else null
    end,
    normalized_category, normalized_offer,
    'available', 'single', false, p_submission_key, now(), null, null, null
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
$$ language plpgsql security definer set search_path = public, storage, extensions;

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

  if p_action = 'submit' and listing_row.status in ('draft', 'rejected', 'expired', 'unavailable', 'pending_review') then
    if not exists (select 1 from public.listing_media where listing_id = p_listing_id) then
      raise exception 'at least one validated image is required' using errcode = '22023';
    end if;
    if not public.is_country_publishable(coalesce(listing_row.country_code, 'ZW')) then
      raise exception 'country is not open for publishing' using errcode = '22023';
    end if;
    next_status := 'available';
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
      submitted_at = case when next_status = 'available' then coalesce(submitted_at, now()) else submitted_at end,
      moderation_reason = case when next_status = 'available' then null else moderation_reason end,
      expires_at = null,
      expiry_notice_sent_at = null
  where id = p_listing_id
  returning * into listing_row;
  return jsonb_build_object('id', listing_row.id, 'kind', listing_row.kind, 'status', listing_row.status);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.public_listing_search_page(
  p_kind text,
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default 0,
  p_max_price numeric default 500000,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  title text,
  description text,
  price numeric,
  currency text,
  deposit numeric,
  agent_fee numeric,
  additional_fees numeric,
  accepts_offers boolean,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  category text,
  listing_type text,
  status text,
  created_via text,
  views integer,
  created_at timestamptz,
  updated_at timestamptz,
  location jsonb,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  cursor_value text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
  cursor_time timestamptz;
  cursor_number numeric;
  cursor_views integer;
begin
  if p_kind not in ('property', 'car', 'machinery')
    or p_sort not in ('newest', 'price_asc', 'price_desc', 'most_viewed')
    or p_limit not between 1 and 50
    or p_min_price < 0
    or p_max_price < p_min_price
    or char_length(normalized_query) > 100
    or char_length(coalesce(p_category, '')) > 80
    or char_length(coalesce(p_location_id, '')) > 64
    or char_length(coalesce(p_brand, '')) > 80
    or char_length(coalesce(p_condition, '')) > 40
    or char_length(coalesce(p_fuel_type, '')) > 40
    or char_length(coalesce(p_transmission, '')) > 40
    or ((p_cursor_value is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid public listing search page' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  if p_cursor_value is not null then
    begin
      if p_sort = 'newest' then cursor_time := p_cursor_value::timestamptz;
      elsif p_sort in ('price_asc', 'price_desc') then cursor_number := p_cursor_value::numeric;
      else cursor_views := p_cursor_value::integer;
      end if;
    exception when others then
      raise exception 'invalid public listing cursor' using errcode = '22023';
    end;
  end if;

  return query
  select
    l.id,
    l.kind::text,
    l.seller_id,
    l.seller_name,
    l.contact_phone,
    l.contact_whatsapp,
    l.contact_email,
    l.title,
    l.description,
    coalesce(l.native_price, l.price),
    coalesce(nullif(l.native_currency, ''), l.currency),
    l.deposit,
    l.agent_fee,
    l.additional_fees,
    l.accepts_offers,
    l.variants,
    l.photos,
    l.public_latitude,
    l.public_longitude,
    l.category,
    l.listing_type,
    l.status::text,
    l.created_via::text,
    l.views,
    l.created_at,
    l.updated_at,
    case when loc.id is null then jsonb_build_object('id', null, 'name', l.public_location_label, 'type', null) else jsonb_build_object('id', loc.id, 'name', coalesce(l.public_location_label, loc.name), 'type', loc.type) end,
    case when cd.listing_id is null then null else jsonb_build_object(
      'brand', cd.brand, 'model', cd.model, 'year', cd.year, 'mileage', cd.mileage,
      'fuel_type', cd.fuel_type, 'transmission', cd.transmission, 'condition', cd.condition
    ) end,
    case when pd.listing_id is null then null else jsonb_build_object(
      'property_type', pd.property_type, 'bedrooms', pd.bedrooms,
      'bathrooms', pd.bathrooms, 'size_sqm', pd.size_sqm
    ) end,
    case when md.listing_id is null then null else jsonb_build_object(
      'machinery_type', md.machinery_type, 'brand', md.brand, 'model', md.model,
      'condition', md.condition, 'year', md.year, 'usage_hours', md.usage_hours
    ) end,
    case p_sort
      when 'newest' then l.created_at::text
      when 'price_asc' then coalesce(l.native_price, l.price)::text
      when 'price_desc' then coalesce(l.native_price, l.price)::text
      else l.views::text
    end
  from public.listings l
  left join public.locations loc on loc.id = l.location_id
  left join public.car_details cd on cd.listing_id = l.id
  left join public.property_details pd on pd.listing_id = l.id
  left join public.machinery_details md on md.listing_id = l.id
  where l.kind::text = p_kind
    and l.status in ('available', 'under_offer')
    and l.content_suspended_at is null
    and public.is_country_browsable(coalesce(l.country_code, loc.country_code, 'ZW'))
    and coalesce(l.native_price, l.price) between p_min_price and p_max_price
    and (coalesce(p_category, '') = '' or l.category = p_category)
    and (coalesce(p_location_id, '') = '' or l.location_id::text = p_location_id)
    and (
      normalized_query = ''
      or l.search_document @@ websearch_to_tsquery('simple'::regconfig, normalized_query)
      or l.title ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (
      (p_kind = 'property' and pd.listing_id is not null and (p_min_bedrooms is null or pd.bedrooms >= p_min_bedrooms))
      or (p_kind = 'car' and cd.listing_id is not null
        and (coalesce(p_brand, '') = '' or cd.brand = p_brand)
        and (coalesce(p_condition, '') = '' or cd.condition = p_condition)
        and (coalesce(p_fuel_type, '') = '' or cd.fuel_type::text = p_fuel_type)
        and (coalesce(p_transmission, '') = '' or cd.transmission::text = p_transmission))
      or (p_kind = 'machinery' and md.listing_id is not null
        and (coalesce(p_brand, '') = '' or md.brand = p_brand)
        and (coalesce(p_condition, '') = '' or md.condition::text = p_condition))
    )
    and (
      p_cursor_id is null
      or (p_sort = 'newest' and (l.created_at, l.id) < (cursor_time, p_cursor_id))
      or (p_sort = 'price_asc' and (coalesce(l.native_price, l.price), l.id) > (cursor_number, p_cursor_id))
      or (p_sort = 'price_desc' and (coalesce(l.native_price, l.price), l.id) < (cursor_number, p_cursor_id))
      or (p_sort = 'most_viewed' and (l.views, l.id) < (cursor_views, p_cursor_id))
    )
  order by
    case when p_sort = 'newest' then l.created_at end desc,
    case when p_sort = 'price_asc' then coalesce(l.native_price, l.price) end asc,
    case when p_sort = 'price_desc' then coalesce(l.native_price, l.price) end desc,
    case when p_sort = 'most_viewed' then l.views end desc,
    case when p_sort = 'price_asc' then l.id end asc,
    case when p_sort <> 'price_asc' then l.id end desc
  limit p_limit + 1;
end;
$$;
