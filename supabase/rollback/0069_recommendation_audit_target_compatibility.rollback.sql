-- 0069_recommendation_audit_target_compatibility.rollback.sql
-- Remove only the UUID compatibility overload. Existing audit records are retained.

drop function if exists public.write_audit_log(text, uuid, text, jsonb, jsonb);

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 68,
    'recommendation_audit_uuid_targets', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
