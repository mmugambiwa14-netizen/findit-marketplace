-- 0047_mvp_service_public_privileges.rollback.sql
-- Revoke only the privileges introduced by 0047. RLS policies and service
-- rows remain untouched.

revoke insert, update, delete on table public.services from authenticated;
revoke select on table public.services from anon, authenticated;
