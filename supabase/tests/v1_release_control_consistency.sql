begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is((select configuration ->> 'renderer' from public.marketplace_operational_controls where control_key='maps'),'maplibre-gl','maps use MapLibre');
select extensions.is((select configuration ->> 'renderer_version' from public.marketplace_operational_controls where control_key='maps'),'5.12.0','MapLibre version is pinned');
select extensions.is((select configuration ->> 'tile_provider' from public.marketplace_operational_controls where control_key='maps'),'maptiler-cloud','maps use MapTiler Cloud');
select extensions.is((select configuration ->> 'public_location_precision' from public.marketplace_operational_controls where control_key='maps'),'city','public map precision is city level');
select extensions.is((select configuration -> 'exact_coordinates_exposed' from public.marketplace_operational_controls where control_key='maps'),'false'::jsonb,'exact coordinates are not public');
select extensions.is((select configuration -> 'services_enabled' from public.marketplace_operational_controls where control_key='recommendation_foundation'),'true'::jsonb,'recommendation service metadata is enabled');
select extensions.is((select configuration -> 'orchestration_executes_services' from public.marketplace_operational_controls where control_key='recommendation_foundation'),'true'::jsonb,'recommendation orchestration metadata is enabled');
select extensions.is((select configuration -> 'personalization_available' from public.marketplace_operational_controls where control_key='recommendation_foundation'),'true'::jsonb,'personalization availability is recorded');
select extensions.is((select count(*)::bigint from public.recommendation_service_policies where enabled=true),7::bigint,'seven recommendation services are enabled');
select extensions.is((select count(*)::bigint from information_schema.role_table_grants where table_schema='public' and table_name='recommendation_events_default' and grantee in('anon','authenticated')),0::bigint,'default event partition has no browser grants');
select extensions.ok(has_table_privilege('service_role','public.recommendation_events_default','SELECT, INSERT, UPDATE, DELETE'),'service role retains event partition access');

select * from extensions.finish();
rollback;
