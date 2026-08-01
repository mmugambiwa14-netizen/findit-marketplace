-- 0102_sub_saharan_location_registry.sql
--
-- Establishes the durable location-registry boundary for the 48 sovereign
-- states in the UN M49 Sub-Saharan Africa region. Countries are intentionally
-- small, stable reference data. Province/state boundaries and populated places
-- are synchronized by scripts/sync-sub-saharan-location-registry.mjs from
-- geoBoundaries and GeoNames, so hundreds of thousands of places do not become
-- a stale application bundle or an unreviewable migration.

create extension if not exists pg_trgm with schema extensions;

alter table public.locations
  add column if not exists search_name text,
  add column if not exists population bigint,
  add column if not exists feature_code text,
  add column if not exists provider_modified_on date,
  add column if not exists coordinate_point extensions.geography(Point, 4326),
  add column if not exists boundary_geometry extensions.geometry(MultiPolygon, 4326);

update public.locations
set search_name = lower(trim(name))
where search_name is null or search_name = '';

alter table public.locations
  alter column search_name set default '',
  alter column search_name set not null;

alter table public.locations
  drop constraint if exists locations_population_nonnegative;
alter table public.locations
  add constraint locations_population_nonnegative
  check (population is null or population >= 0) not valid;
alter table public.locations validate constraint locations_population_nonnegative;

update public.locations
set coordinate_point = extensions.st_setsrid(
  extensions.st_makepoint(longitude::double precision, latitude::double precision),
  4326
)::extensions.geography
where latitude between -90 and 90
  and longitude between -180 and 180
  and coordinate_point is null;

create index if not exists idx_locations_active_parent_place_search
  on public.locations(parent_id, search_name text_pattern_ops, population desc, name)
  where is_active
    and type in (
      'city'::public.location_type,
      'town'::public.location_type,
      'suburb'::public.location_type,
      'neighbourhood'::public.location_type,
      'village'::public.location_type
    );

create index if not exists idx_locations_active_place_coordinates
  on public.locations using gist(coordinate_point)
  where is_active
    and coordinate_point is not null
    and type in (
      'city'::public.location_type,
      'town'::public.location_type,
      'suburb'::public.location_type,
      'neighbourhood'::public.location_type,
      'village'::public.location_type
    );

create index if not exists idx_locations_active_admin_boundaries
  on public.locations using gist(boundary_geometry)
  where is_active
    and boundary_geometry is not null
    and type in (
      'province'::public.location_type,
      'state'::public.location_type,
      'region'::public.location_type
    );

create table if not exists private.location_registry_country_syncs (
  provider text not null,
  release_id text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  source_checksum text not null,
  boundary_source_checksum text not null,
  province_count integer not null check (province_count > 0),
  place_count integer not null check (place_count >= 0),
  spatial_fallback_count integer not null default 0 check (spatial_fallback_count >= 0),
  imported_at timestamptz not null default now(),
  attribution jsonb not null default '{}'::jsonb,
  primary key (provider, release_id, country_code)
);

revoke all on table private.location_registry_country_syncs from public, anon, authenticated;

-- Browsing is enabled across all 48 markets. Publishing remains explicitly
-- activated only for Zimbabwe until each market's operational and payments
-- readiness is certified; this prevents the location rollout from silently
-- changing seller-side country or currency policy.
with markets(country_code, country_name, local_currency) as (
  values
    ('AO', 'Angola', 'AOA'),
    ('BJ', 'Benin', 'XOF'),
    ('BW', 'Botswana', 'BWP'),
    ('BF', 'Burkina Faso', 'XOF'),
    ('BI', 'Burundi', 'BIF'),
    ('CV', 'Cabo Verde', 'CVE'),
    ('CM', 'Cameroon', 'XAF'),
    ('CF', 'Central African Republic', 'XAF'),
    ('TD', 'Chad', 'XAF'),
    ('KM', 'Comoros', 'KMF'),
    ('CG', 'Republic of the Congo', 'XAF'),
    ('CD', 'Democratic Republic of the Congo', 'CDF'),
    ('CI', 'Cote d''Ivoire', 'XOF'),
    ('DJ', 'Djibouti', 'DJF'),
    ('GQ', 'Equatorial Guinea', 'XAF'),
    ('ER', 'Eritrea', 'ERN'),
    ('SZ', 'Eswatini', 'SZL'),
    ('ET', 'Ethiopia', 'ETB'),
    ('GA', 'Gabon', 'XAF'),
    ('GM', 'Gambia', 'GMD'),
    ('GH', 'Ghana', 'GHS'),
    ('GN', 'Guinea', 'GNF'),
    ('GW', 'Guinea-Bissau', 'XOF'),
    ('KE', 'Kenya', 'KES'),
    ('LS', 'Lesotho', 'LSL'),
    ('LR', 'Liberia', 'LRD'),
    ('MG', 'Madagascar', 'MGA'),
    ('MW', 'Malawi', 'MWK'),
    ('ML', 'Mali', 'XOF'),
    ('MR', 'Mauritania', 'MRU'),
    ('MU', 'Mauritius', 'MUR'),
    ('MZ', 'Mozambique', 'MZN'),
    ('NA', 'Namibia', 'NAD'),
    ('NE', 'Niger', 'XOF'),
    ('NG', 'Nigeria', 'NGN'),
    ('RW', 'Rwanda', 'RWF'),
    ('ST', 'Sao Tome and Principe', 'STN'),
    ('SN', 'Senegal', 'XOF'),
    ('SC', 'Seychelles', 'SCR'),
    ('SL', 'Sierra Leone', 'SLE'),
    ('SO', 'Somalia', 'SOS'),
    ('ZA', 'South Africa', 'ZAR'),
    ('SS', 'South Sudan', 'SSP'),
    ('TZ', 'Tanzania', 'TZS'),
    ('TG', 'Togo', 'XOF'),
    ('UG', 'Uganda', 'UGX'),
    ('ZM', 'Zambia', 'ZMW'),
    ('ZW', 'Zimbabwe', 'USD')
)
insert into public.country_configs (
  country_code,
  country_name,
  operational_state,
  supported_listing_currencies,
  default_listing_currency,
  default_display_currency,
  currency_precision,
  currency_notices
)
select
  country_code,
  country_name,
  case when country_code = 'ZW'
    then 'active'::public.country_operational_state
    else 'browse_only'::public.country_operational_state
  end,
  case when country_code = 'ZW'
    then array['USD', 'ZWL', 'ZAR']
    when local_currency = 'USD'
    then array['USD']
    else array['USD', local_currency]
  end,
  case when country_code = 'ZW' then 'USD' else local_currency end,
  'USD',
  '{}'::jsonb,
  '{}'::jsonb
from markets
on conflict (country_code) do update set
  country_name = excluded.country_name,
  operational_state = case
    when public.country_configs.operational_state = 'active' then 'active'::public.country_operational_state
    else excluded.operational_state
  end,
  supported_listing_currencies = case
    when public.country_configs.operational_state = 'active' then public.country_configs.supported_listing_currencies
    else excluded.supported_listing_currencies
  end,
  default_listing_currency = case
    when public.country_configs.operational_state = 'active' then public.country_configs.default_listing_currency
    else excluded.default_listing_currency
  end,
  default_display_currency = case
    when public.country_configs.operational_state = 'active' then public.country_configs.default_display_currency
    else excluded.default_display_currency
  end,
  updated_at = now();

-- Seed only the stable country tier. The sync tool enriches coordinates and
-- provenance and then loads province/state and populated-place tiers.
with countries(country_code, country_name) as (
  values
    ('AO', 'Angola'), ('BJ', 'Benin'), ('BW', 'Botswana'),
    ('BF', 'Burkina Faso'), ('BI', 'Burundi'), ('CV', 'Cabo Verde'),
    ('CM', 'Cameroon'), ('CF', 'Central African Republic'), ('TD', 'Chad'),
    ('KM', 'Comoros'), ('CG', 'Republic of the Congo'),
    ('CD', 'Democratic Republic of the Congo'), ('CI', 'Cote d''Ivoire'),
    ('DJ', 'Djibouti'), ('GQ', 'Equatorial Guinea'), ('ER', 'Eritrea'),
    ('SZ', 'Eswatini'), ('ET', 'Ethiopia'), ('GA', 'Gabon'),
    ('GM', 'Gambia'), ('GH', 'Ghana'), ('GN', 'Guinea'),
    ('GW', 'Guinea-Bissau'), ('KE', 'Kenya'), ('LS', 'Lesotho'),
    ('LR', 'Liberia'), ('MG', 'Madagascar'), ('MW', 'Malawi'),
    ('ML', 'Mali'), ('MR', 'Mauritania'), ('MU', 'Mauritius'),
    ('MZ', 'Mozambique'), ('NA', 'Namibia'), ('NE', 'Niger'),
    ('NG', 'Nigeria'), ('RW', 'Rwanda'), ('ST', 'Sao Tome and Principe'),
    ('SN', 'Senegal'), ('SC', 'Seychelles'), ('SL', 'Sierra Leone'),
    ('SO', 'Somalia'), ('ZA', 'South Africa'), ('SS', 'South Sudan'),
    ('TZ', 'Tanzania'), ('TG', 'Togo'), ('UG', 'Uganda'),
    ('ZM', 'Zambia'), ('ZW', 'Zimbabwe')
), updated as (
  update public.locations location
  set
    name = countries.country_name,
    search_name = lower(countries.country_name),
    source = 'canonical'::public.location_source,
    provider_name = coalesce(location.provider_name, 'un-m49'),
    provider_place_id = coalesce(location.provider_place_id, countries.country_code),
    administrative_labels = location.administrative_labels || jsonb_build_object(
      'un_m49_region', 'Sub-Saharan Africa',
      'un_m49_region_code', '202'
    ),
    promoted_at = coalesce(location.promoted_at, now())
  from countries
  where location.type = 'country'
    and location.country_code = countries.country_code
  returning location.country_code
)
insert into public.locations (
  name,
  search_name,
  type,
  parent_id,
  country_code,
  is_active,
  source,
  provider_name,
  provider_place_id,
  administrative_labels,
  promoted_at
)
select
  countries.country_name,
  lower(countries.country_name),
  'country'::public.location_type,
  null,
  countries.country_code,
  true,
  'canonical'::public.location_source,
  'un-m49',
  countries.country_code,
  jsonb_build_object('un_m49_region', 'Sub-Saharan Africa', 'un_m49_region_code', '202'),
  now()
from countries
where not exists (
  select 1
  from public.locations existing
  where existing.type = 'country'
    and existing.country_code = countries.country_code
);

create or replace function public.search_marketplace_places(
  p_parent_id uuid,
  p_query text,
  p_limit integer default 30
)
returns table (
  id uuid,
  name text,
  type public.location_type,
  parent_id uuid,
  country_code text,
  latitude numeric,
  longitude numeric,
  timezone text,
  population bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as (
    select lower(trim(coalesce(p_query, ''))) as query,
           least(greatest(coalesce(p_limit, 30), 1), 50) as result_limit
  )
  select
    place.id,
    place.name,
    place.type,
    place.parent_id,
    place.country_code,
    place.latitude,
    place.longitude,
    place.timezone,
    place.population
  from public.locations place
  join public.locations administrative_area
    on administrative_area.id = place.parent_id
   and administrative_area.is_active
   and administrative_area.type in (
     'province'::public.location_type,
     'state'::public.location_type,
     'region'::public.location_type
   )
  cross join input
  where place.parent_id = p_parent_id
    and place.is_active
    and place.type in (
      'city'::public.location_type,
      'town'::public.location_type,
      'suburb'::public.location_type,
      'neighbourhood'::public.location_type,
      'village'::public.location_type
    )
    and char_length(input.query) between 0 and 80
    and (
      input.query = ''
      or place.search_name like input.query || '%'
      or place.search_name like '% ' || input.query || '%'
    )
  order by
    case when input.query = '' then 3
         when place.search_name = input.query then 0
         when place.search_name like input.query || '%' then 1
         else 2
    end,
    place.population desc nulls last,
    place.name,
    place.id
  limit (select result_limit from input);
$function$;

create or replace function public.get_marketplace_location_hierarchy(p_location_id uuid)
returns table (
  country_id uuid,
  country_name text,
  country_code text,
  province_id uuid,
  province_name text,
  place_id uuid,
  place_name text,
  place_type public.location_type
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    country.id,
    country.name,
    country.country_code,
    administrative_area.id,
    administrative_area.name,
    place.id,
    place.name,
    place.type
  from public.locations place
  join public.locations administrative_area
    on administrative_area.id = place.parent_id
   and administrative_area.is_active
   and administrative_area.type in (
     'province'::public.location_type,
     'state'::public.location_type,
     'region'::public.location_type
   )
  join public.locations country
    on country.id = administrative_area.parent_id
   and country.is_active
   and country.type = 'country'::public.location_type
  join public.country_configs market
    on market.country_code = country.country_code
   and market.operational_state in (
     'active'::public.country_operational_state,
     'browse_only'::public.country_operational_state
   )
  where place.id = p_location_id
    and place.is_active
    and place.type in (
      'city'::public.location_type,
      'town'::public.location_type,
      'suburb'::public.location_type,
      'neighbourhood'::public.location_type,
      'village'::public.location_type
    );
$function$;

create or replace function public.resolve_marketplace_location(
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  country_id uuid,
  country_name text,
  country_code text,
  province_id uuid,
  province_name text,
  place_id uuid,
  place_name text,
  place_type public.location_type,
  distance_meters bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with input as (
    select
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      ) as geometry_point,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography as geography_point
    where p_latitude between -90 and 90
      and p_longitude between -180 and 180
  ), administrative_area as (
    select
      province.id,
      province.name,
      province.parent_id,
      province.country_code
    from input
    join public.locations province
      on province.is_active
     and province.boundary_geometry is not null
     and province.type in (
       'province'::public.location_type,
       'state'::public.location_type,
       'region'::public.location_type
     )
     and extensions.st_covers(province.boundary_geometry, input.geometry_point)
    join public.country_configs market
      on market.country_code = province.country_code
     and market.operational_state in (
       'active'::public.country_operational_state,
       'browse_only'::public.country_operational_state
     )
    order by extensions.st_area(province.boundary_geometry)
    limit 1
  ), nearest_place as (
    select place.*, input.geography_point
    from administrative_area
    cross join input
    join public.locations place
      on place.parent_id = administrative_area.id
     and place.is_active
     and place.coordinate_point is not null
     and place.type in (
       'city'::public.location_type,
       'town'::public.location_type,
       'suburb'::public.location_type,
       'neighbourhood'::public.location_type,
       'village'::public.location_type
     )
    order by place.coordinate_point OPERATOR(extensions.<->) input.geography_point
    limit 1
  )
  select
    country.id,
    country.name,
    country.country_code,
    administrative_area.id,
    administrative_area.name,
    nearest_place.id,
    nearest_place.name,
    nearest_place.type,
    round(extensions.st_distance(
      nearest_place.coordinate_point,
      nearest_place.geography_point
    ))::bigint
  from nearest_place
  join administrative_area on administrative_area.id = nearest_place.parent_id
  join public.locations country
    on country.id = administrative_area.parent_id
   and country.is_active
   and country.type = 'country'::public.location_type;
$function$;

revoke all on function public.search_marketplace_places(uuid, text, integer) from public;
revoke all on function public.get_marketplace_location_hierarchy(uuid) from public;
revoke all on function public.resolve_marketplace_location(double precision, double precision) from public;

grant execute on function public.search_marketplace_places(uuid, text, integer) to anon, authenticated, service_role;
grant execute on function public.get_marketplace_location_hierarchy(uuid) to anon, authenticated, service_role;
grant execute on function public.resolve_marketplace_location(double precision, double precision) to anon, authenticated, service_role;

grant select (
  search_name,
  population,
  feature_code,
  provider_modified_on,
  coordinate_point,
  boundary_geometry
) on table public.locations to anon, authenticated;

comment on function public.search_marketplace_places(uuid, text, integer) is
  'Indexed populated-place search within one selected province/state; 0102 registry boundary.';
comment on function public.get_marketplace_location_hierarchy(uuid) is
  'Returns the public country/province/place hierarchy for one browsable marketplace place.';
comment on function public.resolve_marketplace_location(double precision, double precision) is
  'Consent-gated, non-persisting nearest-place lookup inside a supported ADM1 boundary.';
