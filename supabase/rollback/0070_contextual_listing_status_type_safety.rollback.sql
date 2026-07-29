-- 0070_contextual_listing_status_type_safety.rollback.sql
-- Safety rollback: retain the explicit enum-to-text comparison. Reintroducing the
-- invalid listing_status = text operator would make every eligible contextual plan
-- fail at runtime. No data, rules, policies, or audit evidence are changed.

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 69,
    'contextual_listing_status_type_safe', true,
    'rollback_0070_retained_safety_fix', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
