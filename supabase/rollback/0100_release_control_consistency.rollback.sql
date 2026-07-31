-- 0100_release_control_consistency.rollback.sql
-- Restore the reviewed pre-0100 operational metadata and browser grants.

do $rollback$
declare
  recommendation_configuration jsonb;
  maps_configuration jsonb;
begin
  select configuration
  into recommendation_configuration
  from public.marketplace_operational_controls
  where control_key = 'recommendation_foundation'
  for update;

  if recommendation_configuration -> 'services_enabled' is distinct from 'true'::jsonb
     or recommendation_configuration -> 'orchestration_executes_services' is distinct from 'true'::jsonb
     or recommendation_configuration -> 'personalization_available' is distinct from 'true'::jsonb
     or recommendation_configuration ->> 'service_policy_source' <> 'recommendation_service_policies'
     or recommendation_configuration ->> 'release_control_version' <> '100' then
    raise exception '0100 rollback refused because recommendation metadata drifted';
  end if;

  select configuration
  into maps_configuration
  from public.marketplace_operational_controls
  where control_key = 'maps'
  for update;

  if maps_configuration ->> 'renderer' <> 'maplibre-gl'
     or maps_configuration ->> 'renderer_version' <> '5.12.0'
     or maps_configuration ->> 'tile_provider' <> 'maptiler-cloud'
     or maps_configuration ->> 'geocoder' <> 'maptiler-geocoding'
     or maps_configuration ->> 'release_control_version' <> '100' then
    raise exception '0100 rollback refused because maps metadata drifted';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'recommendation_events_default'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception '0100 rollback refused because browser table grants were independently restored';
  end if;

  update public.marketplace_operational_controls
  set configuration =
      configuration
      - 'personalization_available'
      - 'service_policy_source'
      - 'active_service_policy_count'
      - 'release_control_version'
      || jsonb_build_object(
        'services_enabled', false,
        'orchestration_executes_services', false,
        'personalization_used', false
      ),
      updated_at = now()
  where control_key = 'recommendation_foundation';

  update public.marketplace_operational_controls
  set configuration = '{}'::jsonb,
      updated_at = now()
  where control_key = 'maps';

  grant all privileges on table public.recommendation_events_default to anon, authenticated;

  if not (
    has_table_privilege('anon', 'public.recommendation_events_default', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    and has_table_privilege('authenticated', 'public.recommendation_events_default', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
  ) then
    raise exception '0100 rollback did not restore the reviewed browser grants';
  end if;

  if (select configuration from public.marketplace_operational_controls where control_key = 'maps') is distinct from '{}'::jsonb
     or (select configuration -> 'services_enabled' from public.marketplace_operational_controls where control_key = 'recommendation_foundation') is distinct from 'false'::jsonb
     or (select configuration -> 'personalization_used' from public.marketplace_operational_controls where control_key = 'recommendation_foundation') is distinct from 'false'::jsonb then
    raise exception '0100 rollback did not restore the reviewed metadata boundary';
  end if;
end;
$rollback$;
