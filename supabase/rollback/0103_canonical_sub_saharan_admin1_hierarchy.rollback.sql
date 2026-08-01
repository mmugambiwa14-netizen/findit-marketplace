-- 0103_canonical_sub_saharan_admin1_hierarchy.rollback.sql
--
-- Restore the 0102 province-boundary resolver. Canonical ADM1 rows and place
-- parents are retained because deleting reference rows would endanger listing
-- foreign keys and make a forward recovery less safe.

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
  ), administrative_area as (
    select province.id, province.name, province.parent_id, province.country_code
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
    round(extensions.st_distance(nearest_place.coordinate_point, nearest_place.geography_point))::bigint
  from nearest_place
  join administrative_area on administrative_area.id = nearest_place.parent_id
  join public.locations country
    on country.id = administrative_area.parent_id
   and country.is_active
   and country.type = 'country'::public.location_type;
$function$;

revoke all on function public.resolve_marketplace_location(double precision, double precision) from public;
grant execute on function public.resolve_marketplace_location(double precision, double precision) to anon, authenticated, service_role;

drop index if exists public.idx_locations_geonames_place_admin1_code;
