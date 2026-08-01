-- 0104_consented_location_resolver_hardening.sql
--
-- Resolve a consented device coordinate only after it falls inside one of the
-- 48 supported country boundaries, then constrain nearest-place work to that
-- country. This avoids both cross-border misclassification and a global scan.

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
  with input as materialized (
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
  ), containing_country as materialized (
    select country.id, country.name, country.country_code
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
  ), nearest_place as materialized (
    select
      place.id,
      place.name,
      place.type,
      place.parent_id,
      place.coordinate_point,
      input.geography_point
    from input
    cross join containing_country country
    cross join lateral (
      select candidate.*
      from public.locations candidate
      where candidate.country_code = country.country_code
        and candidate.is_active
        and candidate.coordinate_point is not null
        and candidate.type in (
          'city'::public.location_type,
          'town'::public.location_type,
          'suburb'::public.location_type,
          'neighbourhood'::public.location_type,
          'village'::public.location_type
        )
      order by candidate.coordinate_point OPERATOR(extensions.<->) input.geography_point
      limit 1
    ) place
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
  from containing_country country
  join nearest_place on true
  join public.locations administrative_area
    on administrative_area.id = nearest_place.parent_id
   and administrative_area.is_active
   and administrative_area.type in (
     'province'::public.location_type,
     'state'::public.location_type,
     'region'::public.location_type
   );
$function$;

revoke all on function public.resolve_marketplace_location(double precision, double precision) from public;
grant execute on function public.resolve_marketplace_location(double precision, double precision) to anon, authenticated, service_role;

comment on function public.resolve_marketplace_location(double precision, double precision) is
  'Consent-gated, non-persisting nearest-place lookup strictly inside a supported country boundary.';
