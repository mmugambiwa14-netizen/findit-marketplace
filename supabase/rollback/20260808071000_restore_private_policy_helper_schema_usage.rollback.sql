-- 20260808071000_restore_private_policy_helper_schema_usage.rollback.sql
-- Restore the immediately preceding schema-privilege state. This intentionally
-- does not alter any per-function or table grants.

begin;

revoke usage on schema private from anon, authenticated;

commit;
