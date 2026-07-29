-- 0061_recommendation_service_runtime_policy_and_cache.rollback.sql
-- Non-destructive rollback: disable runtime caching surfaces while preserving data and evidence.

drop trigger if exists trg_listing_recommendation_cache_invalidation
  on public.listing_recommendation_features;
drop trigger if exists trg_recommendation_taxonomy_cache_invalidation
  on public.recommendation_taxonomy_nodes;
drop trigger if exists trg_recommendation_relationship_cache_invalidation
  on public.recommendation_relationships;

revoke execute on function public.get_recommendation_service_policy_v1(text)
  from service_role;
revoke execute on function public.invalidate_listing_recommendation_cache_v1()
  from service_role;
revoke execute on function public.invalidate_taxonomy_recommendation_cache_v1()
  from service_role;

update public.recommendation_service_policies
set enabled = false,
    updated_at = now();

update public.marketplace_operational_controls
set
  state = 'phase_2_runtime_cache_rolled_back',
  configuration = configuration || jsonb_build_object(
    'runtime_cache_active', false,
    'services_enabled', false,
    'rollback_preserved_cache_rows', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
