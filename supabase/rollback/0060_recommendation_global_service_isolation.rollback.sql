-- 0060_recommendation_global_service_isolation.rollback.sql
-- Restore the 0059 dispatcher-backed wrappers without changing retained service policy evidence.

drop function if exists public.personalized_recommendation_service_v1(uuid, text, integer);
drop function if exists public.recently_listed_service_v1(text, integer);

create function public.recently_listed_service_v1(text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('recently_listed_service', null, null, $1, $2, 50000); $$;

create function public.personalized_recommendation_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('personalized_recommendation_service', null, $1, $2, $3, 50000); $$;

revoke all on function public.recently_listed_service_v1(text, integer) from public, anon, authenticated;
revoke all on function public.personalized_recommendation_service_v1(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.recently_listed_service_v1(text, integer) to service_role;
grant execute on function public.personalized_recommendation_service_v1(uuid, text, integer) to service_role;
grant execute on function public.recommendation_service_v1(text, uuid, uuid, text, integer, integer) to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_2_service_contracts_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 59,
    'direct_shared_dispatcher_access', true,
    'global_services_isolated', false,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
