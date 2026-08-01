-- 0107_location_registry_free_tier_index_budget.rollback.sql

create index if not exists idx_locations_name_trgm
  on public.locations using gin (name extensions.gin_trgm_ops);

create index if not exists idx_locations_country_type_active
  on public.locations(country_code, type, is_active, name);

create index if not exists idx_locations_type
  on public.locations(type);

drop index if exists public.idx_locations_active_hierarchy_lookup;
