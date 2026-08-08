-- Rollback for 20260808231408_saved_services.sql.
-- Preserve the same explicit boundary when the service-save surface is removed.

begin;

revoke all on table public.saved_services from anon, authenticated;
drop policy if exists saved_services_owner_read on public.saved_services;
drop policy if exists saved_services_owner_insert on public.saved_services;
drop policy if exists saved_services_owner_delete on public.saved_services;
drop index if exists public.idx_saved_services_user_keyset;
drop table if exists public.saved_services;

commit;
