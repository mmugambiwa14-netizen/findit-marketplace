-- 0084_remaining_foreign_key_covering_indexes.sql
-- Complete the foreign-key coverage reported by the hosted performance advisor
-- after migration 0083. The recommendation_events index is created on the
-- partitioned parent so PostgreSQL maintains matching indexes on every current
-- and future partition.

create index if not exists idx_fk_recommendation_cache_subject_listing_id
  on public.recommendation_cache (subject_listing_id);

create index if not exists idx_fk_recommendation_events_seller_id
  on public.recommendation_events (seller_id, occurred_at desc, id);

create index if not exists idx_fk_recommendation_service_policies_updated_by
  on public.recommendation_service_policies (updated_by);

create index if not exists idx_fk_recommendation_weight_profiles_created_by
  on public.recommendation_weight_profiles (created_by);
