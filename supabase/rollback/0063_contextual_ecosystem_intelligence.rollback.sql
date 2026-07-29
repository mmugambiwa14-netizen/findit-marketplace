-- 0063_contextual_ecosystem_intelligence.rollback.sql
-- Non-destructive rollback: disable Phase 3 contracts without deleting contextual configuration.

revoke execute on function public.contextual_ecosystem_plan_v1(uuid, text, integer) from service_role;
revoke select on public.recommendation_contexts from service_role;
revoke select on public.recommendation_context_rules from service_role;

update public.recommendation_contexts set is_active = false where is_active;
update public.recommendation_context_rules set is_active = false where is_active;

update public.marketplace_operational_controls
set
  state = 'phase_2_source_complete_phase_3_disabled',
  configuration = configuration || jsonb_build_object(
    'contextual_plan_enabled', false,
    'listing_delivery_dependency', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
