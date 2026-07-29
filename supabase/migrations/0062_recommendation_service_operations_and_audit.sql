-- 0062_recommendation_service_operations_and_audit.sql
-- Phase 2 operational boundary: audited service configuration, health and bounded cache control.

alter table public.recommendation_service_policies
  add column if not exists id uuid default gen_random_uuid();
update public.recommendation_service_policies set id = gen_random_uuid() where id is null;
alter table public.recommendation_service_policies alter column id set not null;
create unique index if not exists idx_recommendation_service_policies_id
  on public.recommendation_service_policies(id);

alter table public.recommendation_configuration_audit
  drop constraint if exists recommendation_configuration_audit_entity_type_check;
alter table public.recommendation_configuration_audit
  add constraint recommendation_configuration_audit_entity_type_check
  check (entity_type in ('taxonomy_node', 'relationship', 'weight_profile', 'service_policy'));

alter table public.recommendation_configuration_audit
  drop constraint if exists recommendation_configuration_audit_action_check;
alter table public.recommendation_configuration_audit
  add constraint recommendation_configuration_audit_action_check
  check (action in ('create', 'update', 'activate', 'deactivate', 'purge_cache'));

create or replace function public.admin_update_recommendation_service_policy_v1(
  p_service_name text,
  p_enabled boolean,
  p_timeout_ms integer,
  p_cache_fresh_seconds integer,
  p_cache_stale_seconds integer,
  p_maximum_page_size integer,
  p_configuration jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_id uuid;
  before_value jsonb;
  after_value jsonb;
  action_value text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_service_name not in (
    'similar_listings_service',
    'seller_recommendations_service',
    'related_services_service',
    'related_products_service',
    'nearby_service',
    'recently_listed_service',
    'personalized_recommendation_service'
  )
    or p_timeout_ms not between 50 and 5000
    or p_cache_fresh_seconds not between 0 and 3600
    or p_cache_stale_seconds not between 1 and 86400
    or p_cache_stale_seconds < p_cache_fresh_seconds
    or p_maximum_page_size not between 1 and 100
    or jsonb_typeof(coalesce(p_configuration, 'null'::jsonb)) <> 'object'
    or octet_length(coalesce(p_configuration, '{}'::jsonb)::text) > 8192
  then
    raise exception 'invalid recommendation service policy' using errcode = '22023';
  end if;

  select policy.id, to_jsonb(policy)
  into policy_id, before_value
  from public.recommendation_service_policies policy
  where policy.service_name = p_service_name
  for update;

  if not found then
    raise exception 'recommendation service policy does not exist' using errcode = '22023';
  end if;

  update public.recommendation_service_policies
  set
    enabled = p_enabled,
    timeout_ms = p_timeout_ms,
    cache_fresh_seconds = p_cache_fresh_seconds,
    cache_stale_seconds = p_cache_stale_seconds,
    maximum_page_size = p_maximum_page_size,
    configuration = p_configuration,
    updated_at = now(),
    updated_by = auth.uid()
  where service_name = p_service_name
  returning to_jsonb(recommendation_service_policies.*)
  into after_value;

  action_value := case
    when coalesce((before_value ->> 'enabled')::boolean, false) is distinct from p_enabled
      then case when p_enabled then 'activate' else 'deactivate' end
    else 'update'
  end;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(), 'service_policy', policy_id, action_value, before_value, after_value
  );

  perform public.write_audit_log(
    'recommendation.service_policy.' || action_value,
    policy_id,
    'recommendation_service_policy'
  );

  return after_value;
end;
$$;

revoke all on function public.admin_update_recommendation_service_policy_v1(
  text, boolean, integer, integer, integer, integer, jsonb
) from public, anon;
grant execute on function public.admin_update_recommendation_service_policy_v1(
  text, boolean, integer, integer, integer, integer, jsonb
) to authenticated;

create or replace function public.admin_purge_recommendation_service_cache_v1(
  p_service_name text,
  p_subject_listing_id uuid default null,
  p_limit integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  policy_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select policy.id into policy_id
  from public.recommendation_service_policies policy
  where policy.service_name = p_service_name;

  if policy_id is null or p_limit not between 1 and 50000 then
    raise exception 'invalid recommendation cache purge request' using errcode = '22023';
  end if;

  with targets as (
    select cache_key
    from public.recommendation_cache
    where service_name = p_service_name
      and (p_subject_listing_id is null or subject_listing_id = p_subject_listing_id)
    order by generated_at, cache_key
    limit p_limit
    for update skip locked
  )
  delete from public.recommendation_cache cache
  using targets
  where cache.cache_key = targets.cache_key;

  get diagnostics deleted_count = row_count;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(),
    'service_policy',
    policy_id,
    'purge_cache',
    null,
    jsonb_build_object(
      'service_name', p_service_name,
      'subject_listing_id', p_subject_listing_id,
      'deleted_count', deleted_count,
      'limit', p_limit
    )
  );

  perform public.write_audit_log(
    'recommendation.service_cache.purge',
    policy_id,
    'recommendation_service_policy'
  );

  return deleted_count;
end;
$$;

revoke all on function public.admin_purge_recommendation_service_cache_v1(text, uuid, integer)
  from public, anon;
grant execute on function public.admin_purge_recommendation_service_cache_v1(text, uuid, integer)
  to authenticated;

create or replace function public.recommendation_services_health_v1()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'contractVersion', 1,
    'generatedAt', now(),
    'services', coalesce(jsonb_agg(jsonb_build_object(
      'serviceName', policy.service_name,
      'enabled', policy.enabled,
      'contractVersion', policy.contract_version,
      'timeoutMs', policy.timeout_ms,
      'maximumPageSize', policy.maximum_page_size,
      'cacheFreshSeconds', policy.cache_fresh_seconds,
      'cacheStaleSeconds', policy.cache_stale_seconds,
      'freshCacheEntries', coalesce(cache_stats.fresh_entries, 0),
      'staleCacheEntries', coalesce(cache_stats.stale_entries, 0),
      'expiredCacheEntries', coalesce(cache_stats.expired_entries, 0),
      'updatedAt', policy.updated_at
    ) order by policy.service_name), '[]'::jsonb)
  )
  from public.recommendation_service_policies policy
  left join lateral (
    select
      count(*) filter (where cache.stale_at > now())::integer as fresh_entries,
      count(*) filter (where cache.stale_at <= now() and cache.expires_at > now())::integer as stale_entries,
      count(*) filter (where cache.expires_at <= now())::integer as expired_entries
    from public.recommendation_cache cache
    where cache.service_name = policy.service_name
  ) cache_stats on true;
$$;

revoke all on function public.recommendation_services_health_v1()
  from public, anon, authenticated;
grant execute on function public.recommendation_services_health_v1()
  to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_2_operational_controls_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 62,
    'audited_service_policy_admin', true,
    'bounded_cache_purge', true,
    'service_health_contract', 'recommendation_services_health_v1',
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.admin_update_recommendation_service_policy_v1(text, boolean, integer, integer, integer, integer, jsonb)
  is 'Admin-only audited recommendation service enablement and runtime policy contract.';
comment on function public.admin_purge_recommendation_service_cache_v1(text, uuid, integer)
  is 'Admin-only bounded cache purge with durable audit evidence.';
comment on function public.recommendation_services_health_v1()
  is 'Service-role health summary for recommendation enablement and cache state. It exposes no customer identity or behavioural data.';