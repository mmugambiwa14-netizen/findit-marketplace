-- 0102_sub_saharan_location_registry.rollback.sql
--
-- Stop exposing the 0102 query surface without deleting imported registry
-- rows, boundaries, or provenance. Retaining additive data keeps listing
-- foreign keys and an emergency forward recovery safe.

revoke all on function public.search_marketplace_places(uuid, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_marketplace_location_hierarchy(uuid) from public, anon, authenticated, service_role;
revoke all on function public.resolve_marketplace_location(double precision, double precision) from public, anon, authenticated, service_role;

drop function if exists public.search_marketplace_places(uuid, text, integer);
drop function if exists public.get_marketplace_location_hierarchy(uuid);
drop function if exists public.resolve_marketplace_location(double precision, double precision);

drop index if exists public.idx_locations_active_parent_place_search;
drop index if exists public.idx_locations_active_place_coordinates;
drop index if exists public.idx_locations_active_admin_boundaries;

revoke select (
  search_name,
  population,
  feature_code,
  provider_modified_on,
  coordinate_point,
  boundary_geometry
) on table public.locations from anon, authenticated;
