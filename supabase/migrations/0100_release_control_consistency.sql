-- 0100_release_control_consistency.sql
--
-- Make operational metadata reflect the active recommendation service layer and
-- the certified MapLibre/MapTiler browser contract. Remove redundant browser
-- table privileges from the fail-closed recommendation event default partition.
do $migration$
declare
  service_count integer;
  rpc_service_count integer;
  recommendation_configuration jsonb;
  maps_configuration jsonb;
  rpc_target record;
begin
  -- Migration 0059 creates the complete policy catalog with every service
  -- disabled. This migration is the reviewed release-control activation point,
  -- so enable the exact catalog before certifying that all seven policies exist.
  update public.recommendation_service_policies
  set enabled = true,
      updated_at = now()
  where service_name in (
    'nearby_service',
    'personalized_recommendation_service',
    'recently_listed_service',
    'related_products_service',
    'related_services_service',
    'seller_recommendations_service',
    'similar_listings_service'
  );

  select count(*)::integer
  into service_count
  from public.recommendation_service_policies
  where enabled = true
    and service_name in (
      'nearby_service',
      'personalized_recommendation_service',
      'recently_listed_service',
      'related_products_service',
      'related_services_service',
      'seller_recommendations_service',
      'similar_listings_service'
    );

  if service_count <> 7 then
    raise exception '0100 expected seven enabled recommendation service policies, found %', service_count;
  end if;

  select configuration
  into recommendation_configuration
  from public.marketplace_operational_controls
  where control_key = 'recommendation_foundation'
    and enabled = true
    and state = 'service_catalog_aligned'
  for update;

  if recommendation_configuration is null then
    raise exception '0100 expected the enabled recommendation_foundation control';
  end if;

  if recommendation_configuration -> 'services_enabled' is distinct from 'false'::jsonb
     or recommendation_configuration -> 'orchestration_executes_services' is distinct from 'false'::jsonb
     or recommendation_configuration -> 'personalization_used' is distinct from 'false'::jsonb then
    raise exception '0100 refused because recommendation_foundation metadata drifted from the reviewed boundary';
  end if;

  select configuration
  into maps_configuration
  from public.marketplace_operational_controls
  where control_key = 'maps'
    and enabled = true
    and state = 'enabled'
  for update;

  if maps_configuration is distinct from '{}'::jsonb then
    raise exception '0100 refused because maps configuration is not the reviewed empty object';
  end if;

  if not (
    has_table_privilege('anon', 'public.recommendation_events_default', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    and has_table_privilege('authenticated', 'public.recommendation_events_default', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
  ) then
    raise exception '0100 refused because default recommendation-event browser grants drifted';
  end if;

  update public.marketplace_operational_controls
  set configuration =
      (configuration - 'personalization_used')
      || jsonb_build_object(
        'services_enabled', true,
        'orchestration_executes_services', true,
        'personalization_available', true,
        'service_policy_source', 'recommendation_service_policies',
        'active_service_policy_count', service_count,
        'release_control_version', 100
      ),
      updated_at = now()
  where control_key = 'recommendation_foundation';

  update public.marketplace_operational_controls
  set configuration = jsonb_build_object(
        'renderer', 'maplibre-gl',
        'renderer_version', '5.12.0',
        'tile_provider', 'maptiler-cloud',
        'geocoder', 'maptiler-geocoding',
        'style_environment_variable', 'VITE_MAPTILER_STYLE_ID',
        'public_location_precision', 'city',
        'exact_coordinates_exposed', false,
        'current_location_requires_consent', true,
        'manual_location_fallback_required', true,
        'release_control_version', 100
      ),
      updated_at = now()
  where control_key = 'maps';

  revoke all privileges on table public.recommendation_events_default from anon, authenticated;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'recommendation_events_default'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception '0100 left browser table privileges on recommendation_events_default';
  end if;

  if not has_table_privilege('service_role', 'public.recommendation_events_default', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception '0100 unexpectedly removed service_role access to recommendation_events_default';
  end if;

  -- Supabase CLI role snapshots no longer seed the historical service-role
  -- function defaults used when the 0101 catalog fingerprint was certified.
  -- Restate the exact 53 server execution paths. The four recommendation
  -- administration functions below are intentionally authenticated-admin only.
  for rpc_target in
    select function_record.oid::regprocedure::text as signature
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.prokind = 'f'
      and function_record.prosecdef
      and has_function_privilege('authenticated', function_record.oid, 'EXECUTE')
      and function_record.proname not in (
        'admin_purge_recommendation_service_cache_v1',
        'admin_recommendation_analytics_v1',
        'admin_update_recommendation_service_policy_v1',
        'admin_upsert_recommendation_context_rule_v1'
      )
    order by function_record.proname, pg_get_function_identity_arguments(function_record.oid)
  loop
    execute format('grant execute on function %s to service_role', rpc_target.signature);
  end loop;

  select count(*)::integer
  into rpc_service_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.prokind = 'f'
    and function_record.prosecdef
    and has_function_privilege('authenticated', function_record.oid, 'EXECUTE')
    and has_function_privilege('service_role', function_record.oid, 'EXECUTE');

  if rpc_service_count <> 53 then
    raise exception '0100 expected 53 service-role authenticated RPC paths, found %', rpc_service_count;
  end if;

  if (select configuration ->> 'renderer' from public.marketplace_operational_controls where control_key = 'maps') <> 'maplibre-gl'
     or (select configuration ->> 'tile_provider' from public.marketplace_operational_controls where control_key = 'maps') <> 'maptiler-cloud'
     or (select configuration -> 'services_enabled' from public.marketplace_operational_controls where control_key = 'recommendation_foundation') is distinct from 'true'::jsonb
     or (select configuration -> 'personalization_available' from public.marketplace_operational_controls where control_key = 'recommendation_foundation') is distinct from 'true'::jsonb then
    raise exception '0100 did not create the expected release-control boundary';
  end if;
end;
$migration$;
