-- 0074_nearby_service_hosted_timeout_budget.sql
-- Hosted certification demonstrated that 250 ms is not a reliable
-- Edge-to-PostgREST budget for the indexed geospatial service query.

update public.recommendation_service_policies
set
  timeout_ms = greatest(timeout_ms, 1000),
  updated_at = now()
where service_name = 'nearby_service'
  and timeout_ms < 1000;

update public.marketplace_operational_controls
set
  state = 'phase_7_hosted_timeout_budget',
  configuration = configuration || jsonb_build_object(
    'schema_version', 74,
    'nearby_service_timeout_ms', 1000,
    'nearby_service_geospatial_indexed', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on column public.recommendation_service_policies.timeout_ms
  is 'Abortable Edge-to-PostgREST execution budget in milliseconds; bounded between 50 and 5000.';
