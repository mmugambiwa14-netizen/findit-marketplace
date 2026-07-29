-- 0056_recommendation_partition_and_configuration_integrity.rollback.sql
-- Fail closed and preserve partitioned events, configuration history and projections.

revoke all on function public.ensure_recommendation_event_partition(date) from service_role;
revoke all on function public.recommendation_foundation_health() from service_role;
revoke all on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) from authenticated;
revoke all on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) from authenticated;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'partition_and_configuration_integrity_rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_foundation',
  'recommendation_projection',
  'recommendation_event_collection',
  'recommendation_retention'
);

alter table public.recommendation_taxonomy_nodes force row level security;
alter table public.recommendation_relationships force row level security;
alter table public.recommendation_weight_profiles force row level security;
alter table public.recommendation_configuration_audit force row level security;
alter table public.recommendation_events force row level security;
alter table public.recommendation_events_default force row level security;
