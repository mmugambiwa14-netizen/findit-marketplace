-- 0069_recommendation_audit_target_compatibility.sql
-- Recommendation administration uses UUID entity identifiers while the shared V1
-- audit writer accepts text target identifiers. PostgreSQL does not implicitly cast
-- uuid to text during function resolution, so hosted admin operations failed after
-- their configuration audit insert and rolled back the complete transaction.

create or replace function public.write_audit_log(
  action_name text,
  target_id uuid,
  target_type text default null,
  before_snapshot jsonb default null,
  after_snapshot jsonb default null
)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select public.write_audit_log(
    action_name,
    target_id::text,
    target_type,
    before_snapshot,
    after_snapshot
  );
$$;

revoke all on function public.write_audit_log(text, uuid, text, jsonb, jsonb)
  from public, anon, service_role;
grant execute on function public.write_audit_log(text, uuid, text, jsonb, jsonb)
  to authenticated;

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 69,
    'recommendation_audit_uuid_targets', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.write_audit_log(text, uuid, text, jsonb, jsonb)
  is 'UUID-compatible authenticated wrapper for the shared text-target audit writer.';
