-- 0084_recommendation_foreign_key_covering_indexes.sql
-- Close the recommendation-layer foreign-key index findings that become
-- visible after the broader marketplace index set is installed. Creating the
-- seller index on the partitioned event parent creates matching indexes on all
-- existing partitions and on future attached partitions through the parent.

create index if not exists idx_fk_recommendation_cache_subject_listing_id
  on public.recommendation_cache (subject_listing_id);

create index if not exists idx_fk_recommendation_events_seller_id
  on public.recommendation_events (seller_id);

create index if not exists idx_fk_recommendation_service_policies_updated_by
  on public.recommendation_service_policies (updated_by);

create index if not exists idx_fk_recommendation_weight_profiles_created_by
  on public.recommendation_weight_profiles (created_by);
