-- 0047_mvp_service_public_privileges.sql
-- Table privileges must exist before RLS policies can expose active services
-- through PostgREST. Earlier migrations define the policies but omit grants.

grant select on table public.services to anon, authenticated;
grant insert, update, delete on table public.services to authenticated;
