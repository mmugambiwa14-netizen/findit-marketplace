-- 0061_recommendation_service_runtime_policy_and_cache.sql
-- Phase 2 runtime hardening: policy reads, cache invalidation and least-privilege service configuration.

revoke insert, update, delete on public.recommendation_service_policies from service_role;
grant select on public.recommendation_service_policies to service_role;

create or replace function public.get_recommendation_service_policy_v1(p_service_name text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'serviceName', policy.service_name,
    'contractVersion', policy.contract_version,
    'enabled', policy.enabled,
    'timeoutMs', policy.timeout_ms,
    'cacheFreshSeconds', policy.cache_fresh_seconds,
    'cacheStaleSeconds', policy.cache_stale_seconds,
    'maximumPageSize', policy.maximum_page_size,
    'configuration', policy.configuration,
    'updatedAt', policy.updated_at
  )
  from public.recommendation_service_policies policy
  where policy.service_name = p_service_name;
$$;

revoke all on function public.get_recommendation_service_policy_v1(text)
  from public, anon, authenticated;
grant execute on function public.get_recommendation_service_policy_v1(text)
  to service_role;

create or replace function public.invalidate_listing_recommendation_cache_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_listing_id uuid;
begin
  affected_listing_id := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;

  begin
    delete from public.recommendation_cache cache
    where cache.subject_listing_id = affected_listing_id
       or cache.payload @> jsonb_build_object(
         'items', jsonb_build_array(jsonb_build_object('listingId', affected_listing_id))
       );
  exception when others then
    -- Cache invalidation is best effort. Projection and listing writes remain authoritative.
    null;
  end;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.invalidate_listing_recommendation_cache_v1()
  from public, anon, authenticated;

drop trigger if exists trg_listing_recommendation_cache_invalidation
  on public.listing_recommendation_features;
create trigger trg_listing_recommendation_cache_invalidation
  after insert or update or delete on public.listing_recommendation_features
  for each row execute function public.invalidate_listing_recommendation_cache_v1();

create or replace function public.invalidate_taxonomy_recommendation_cache_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    delete from public.recommendation_cache
    where service_name in (
      'similar_listings_service',
      'related_services_service',
      'related_products_service',
      'personalized_recommendation_service'
    );
  exception when others then
    null;
  end;

  return null;
end;
$$;

revoke all on function public.invalidate_taxonomy_recommendation_cache_v1()
  from public, anon, authenticated;

drop trigger if exists trg_recommendation_taxonomy_cache_invalidation
  on public.recommendation_taxonomy_nodes;
create trigger trg_recommendation_taxonomy_cache_invalidation
  after insert or update or delete on public.recommendation_taxonomy_nodes
  for each statement execute function public.invalidate_taxonomy_recommendation_cache_v1();

drop trigger if exists trg_recommendation_relationship_cache_invalidation
  on public.recommendation_relationships;
create trigger trg_recommendation_relationship_cache_invalidation
  after insert or update or delete on public.recommendation_relationships
  for each statement execute function public.invalidate_taxonomy_recommendation_cache_v1();

update public.marketplace_operational_controls
set
  state = 'phase_2_runtime_cache_hardened',
  configuration = configuration || jsonb_build_object(
    'schema_version', 61,
    'runtime_policy_rpc', 'get_recommendation_service_policy_v1',
    'public_result_cache', true,
    'personalized_shared_cache', false,
    'fail_open_cache_invalidation', true,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.get_recommendation_service_policy_v1(text)
  is 'Service-role-only runtime policy contract. Edge services use it for enablement, timeout, page-size and cache boundaries.';
comment on function public.invalidate_listing_recommendation_cache_v1()
  is 'Best-effort cache invalidation for changed recommendation projections. Failure never blocks listing or projection writes.';
