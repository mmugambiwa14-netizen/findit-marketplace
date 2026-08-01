-- 0106_active_country_boundary_spatial_index.sql
-- Limit consented coordinate containment checks to bounding-box candidates
-- before evaluating the exact national polygon.

create index if not exists idx_locations_active_country_boundaries
  on public.locations using gist(boundary_geometry)
  where is_active
    and boundary_geometry is not null
    and type = 'country'::public.location_type;

comment on index public.idx_locations_active_country_boundaries is
  'Partial GiST index for consented supported-country containment checks.';
