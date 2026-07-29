-- 0059_independent_recommendation_services.rollback.sql
-- Non-destructive rollback: disable and remove Phase 2 callable contracts while preserving policy evidence.

update public.recommendation_service_policies
set enabled = false, updated_at = now()
where true;

drop function if exists public.personalized_recommendation_service_v1(uuid, text, integer);
drop function if exists public.recently_listed_service_v1(text, integer);
drop function if exists public.nearby_service_v1(uuid, text, integer, integer);
drop function if exists public.related_products_service_v1(uuid, text, integer);
drop function if exists public.related_services_service_v1(uuid, text, integer);
drop function if exists public.seller_recommendations_service_v1(uuid, text, integer);
drop function if exists public.similar_listings_service_v1(uuid, text, integer);
drop function if exists public.recommendation_service_v1(text, uuid, uuid, text, integer, integer);
drop function if exists public.encode_recommendation_cursor_v1(numeric, timestamptz, uuid);
drop function if exists public.decode_recommendation_cursor_v1(text);

drop index if exists public.idx_recommendation_features_seller_recent_cursor;
drop index if exists public.idx_recommendation_features_category_recent_cursor;
drop index if exists public.idx_recommendation_features_recent_cursor;

update public.marketplace_operational_controls
set
  state = 'phase_1_publication_closed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 58,
    'service_contract_version', null,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

-- recommendation_service_policies is intentionally retained as disabled operational evidence.
