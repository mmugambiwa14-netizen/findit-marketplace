-- 0108_location_registry_parent_index_deduplication.rollback.sql

create index if not exists idx_locations_parent
  on public.locations(parent_id);
