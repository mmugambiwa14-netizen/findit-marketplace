-- 0064_contextual_rule_identity_and_admin.rollback.sql
-- Remove execution privileges while preserving audit and rule history.

revoke execute on function public.admin_upsert_recommendation_context_rule_v1(
  text, uuid, text, text, integer, integer, jsonb, boolean, timestamptz, timestamptz
) from authenticated;

update public.marketplace_operational_controls
set configuration = configuration || jsonb_build_object(
  'audited_context_rule_admin', false
), updated_at = now()
where control_key = 'recommendation_foundation';
