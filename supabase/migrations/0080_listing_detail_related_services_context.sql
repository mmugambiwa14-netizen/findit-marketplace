-- 0080_listing_detail_related_services_context.sql
-- Listing detail pages use the evaluate journey. Add an explicit related-services
-- section to that journey so the executable service is not limited to the later
-- prepare stage.

insert into public.recommendation_contexts (
  stable_key,
  label,
  journey_stage,
  priority,
  is_active,
  attributes
)
values (
  'listing_support',
  'Services for this listing',
  'evaluate',
  30,
  true,
  '{"surface":"listing_detail","schema_version":80}'::jsonb
)
on conflict (stable_key) do update set
  label = excluded.label,
  journey_stage = excluded.journey_stage,
  priority = excluded.priority,
  is_active = true,
  attributes = public.recommendation_contexts.attributes || excluded.attributes,
  updated_at = now();

insert into public.recommendation_context_rules (
  context_id,
  source_node_id,
  service_name,
  reason_code,
  priority,
  maximum_items,
  conditions,
  is_active,
  valid_from,
  valid_until
)
select
  context.id,
  null,
  'related_services_service',
  'services_for_listing',
  30,
  6,
  '{}'::jsonb,
  true,
  now(),
  null
from public.recommendation_contexts context
where context.stable_key = 'listing_support'
on conflict (context_id, source_node_id, service_name, reason_code) do update set
  priority = excluded.priority,
  maximum_items = excluded.maximum_items,
  conditions = excluded.conditions,
  is_active = true,
  valid_until = null,
  updated_at = now();

insert into public.marketplace_operational_controls (
  control_key,
  enabled,
  state,
  configuration
)
values (
  'recommendation_contextual_ecosystem',
  true,
  'listing_detail_services_enabled',
  '{"schema_version":80,"evaluate_related_services":true}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = public.marketplace_operational_controls.configuration || excluded.configuration,
  updated_at = now();
