-- 0084_remaining_foreign_key_covering_indexes.rollback.sql
-- Removes only the additive indexes introduced by migration 0084. Dropping the
-- partitioned parent index also removes its automatically managed child indexes.

drop index if exists public.idx_fk_recommendation_weight_profiles_created_by;
drop index if exists public.idx_fk_recommendation_service_policies_updated_by;
drop index if exists public.idx_fk_recommendation_events_seller_id;
drop index if exists public.idx_fk_recommendation_cache_subject_listing_id;
