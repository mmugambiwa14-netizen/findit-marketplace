-- 0104_consented_location_resolver_hardening.rollback.sql
-- Restore the 0103 resolver while preserving all registry data.

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
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326) as geometry_point,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography as geography_point
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  ), containing_country as (
    select country.id, country.country_code
    from input
    join public.locations country
      on country.type = 'country'::public.location_type
     and country.is_active
     and country.boundary_geometry is not null
     and extensions.st_covers(country.boundary_geometry, input.geometry_point)
    join public.country_configs market
      on market.country_code = country.country_code
     and market.operational_state in (
       'active'::public.country_operational_state,
       'browse_only'::public.country_operational_state
     )
    order by extensions.st_area(country.boundary_geometry), country.id
    limit 1
  ), nearest_place as (
    select
      place.id as place_id,
      place.name as place_name,
      place.type as place_type,
      place.coordinate_point,
      administrative_area.id as province_id,
      administrative_area.name as province_name,
      country.id as country_id,
      country.name as country_name,
      country.country_code,
      input.geography_point
    from input
    join public.locations place
      on place.is_active
     and place.coordinate_point is not null
     and place.type in (
       'city'::public.location_type,
       'town'::public.location_type,
       'suburb'::public.location_type,
       'neighbourhood'::public.location_type,
       'village'::public.location_type
     )
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
    where not exists (select 1 from containing_country)
       or country.id = (select id from containing_country)
    order by place.coordinate_point OPERATOR(extensions.<->) input.geography_point
    limit 1
  )
  select
    nearest_place.country_id,
    nearest_place.country_name,
    nearest_place.country_code,
    nearest_place.province_id,
    nearest_place.province_name,
    nearest_place.place_id,
    nearest_place.place_name,
    nearest_place.place_type,
    round(extensions.st_distance(nearest_place.coordinate_point, nearest_place.geography_point))::bigint
  from nearest_place;
$function$;

revoke all on function public.resolve_marketplace_location(double precision, double precision) from public;
grant execute on function public.resolve_marketplace_location(double precision, double precision) to anon, authenticated, service_role;

comment on function public.resolve_marketplace_location(double precision, double precision) is
  'Consent-gated, non-persisting nearest canonical place lookup, constrained by a supported country boundary when available.';
