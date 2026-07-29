-- 0062_recommendation_service_operations_and_audit.rollback.sql
-- Preserve service policy and audit data while withdrawing Phase 2 operational APIs.

update public.recommendation_service_policies
set enabled = false, updated_at = now()
where enabled;

revoke execute on function public.admin_update_recommendation_service_policy_v1(
  text, boolean, integer, integer, integer, integer, jsonb
) from authenticated;
revoke execute on function public.admin_purge_recommendation_service_cache_v1(text, uuid, integer)
  from authenticated;
revoke execute on function public.recommendation_services_health_v1()
  from service_role;

drop function if exists public.admin_update_recommendation_service_policy_v1(
  text, boolean, integer, integer, integer, integer, jsonb
);
drop function if exists public.admin_purge_recommendation_service_cache_v1(text, uuid, integer);
drop function if exists public.recommendation_services_health_v1();

update public.marketplace_operational_controls
set
  state = 'phase_2_runtime_cache_hardened',
  configuration = configuration || jsonb_build_object(
    'services_enabled', false,
    'audited_service_policy_admin', false,
    'bounded_cache_purge', false,
    'service_health_contract', null
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';