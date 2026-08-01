-- 0107_location_registry_free_tier_index_budget.sql
--
-- The full Sub-Saharan place registry makes three pre-registry indexes costly
-- and redundant. Prefix/place search has its dedicated parent index, country
-- filtering retains idx_locations_country, and the small hierarchy tier gets
-- a purpose-built partial index.

create index if not exists idx_locations_active_hierarchy_lookup
  on public.locations(type, country_code, parent_id, name)
  where is_active
    and type in (
      'country'::public.location_type,
      'province'::public.location_type,
      'state'::public.location_type,
      'region'::public.location_type
    );

drop index if exists public.idx_locations_name_trgm;
drop index if exists public.idx_locations_country_type_active;
drop index if exists public.idx_locations_type;

comment on index public.idx_locations_active_hierarchy_lookup is
  'Compact active country/province/state/region selector index for the full place registry.';
