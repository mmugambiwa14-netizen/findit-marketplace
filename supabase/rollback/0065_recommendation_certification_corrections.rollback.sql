-- 0065_recommendation_certification_corrections.rollback.sql
-- Operational rollback only. Data and audit history remain intact.

comment on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean)
  is '0065 rollback marker: retain corrected implementation to avoid restoring the obsolete audit signature.';
comment on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz)
  is '0065 rollback marker: retain corrected implementation to avoid restoring the obsolete audit signature.';
comment on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean)
  is '0065 rollback marker: retain corrected implementation to avoid restoring the obsolete audit signature.';

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem_foundation_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 64,
    'anonymous_raw_event_select', false,
    'recommendation_admin_audit_contract', 'recommendation_configuration_audit',
    '0065_operational_rollback', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';