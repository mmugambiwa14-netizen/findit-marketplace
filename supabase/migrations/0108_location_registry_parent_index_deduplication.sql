-- 0108_location_registry_parent_index_deduplication.sql
--
-- Active populated-place parent lookups are covered by
-- idx_locations_active_parent_place_search. Active hierarchy parent lookups
-- are covered by idx_locations_active_hierarchy_lookup. The original broad
-- parent index is therefore duplicate storage at full registry scale.

drop index if exists public.idx_locations_parent;
