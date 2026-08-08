-- 20260808081000_private_taxonomy_admin_implementations.rollback.sql
-- Safety rollback: moving privileged implementations back into the exposed
-- public schema would knowingly violate the authenticated RPC security model.
-- Preserve the hardened private/public split and reassert only client grants.

begin;

revoke all on function public.admin_taxonomy_rows() from public, anon, service_role;
grant execute on function public.admin_taxonomy_rows() to authenticated;
revoke all on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text)
  from public, anon, service_role;
grant execute on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text)
  to authenticated;
revoke all on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text)
  from public, anon, service_role;
grant execute on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text)
  to authenticated;

revoke all on function public.admin_taxonomy_rows_v2() from public, anon, service_role;
grant execute on function public.admin_taxonomy_rows_v2() to authenticated;
revoke all on function public.admin_add_taxonomy_node_v2(uuid, text, text, text, text, text, boolean, integer, jsonb, text[], text[], jsonb, text[], text)
  from public, anon, service_role;
grant execute on function public.admin_add_taxonomy_node_v2(uuid, text, text, text, text, text, boolean, integer, jsonb, text[], text[], jsonb, text[], text)
  to authenticated;
revoke all on function public.admin_update_taxonomy_node_v2(uuid, text, text, text, integer, boolean, boolean, text[], text[], jsonb, text[], uuid, timestamptz, jsonb, text)
  from public, anon, service_role;
grant execute on function public.admin_update_taxonomy_node_v2(uuid, text, text, text, integer, boolean, boolean, text[], text[], jsonb, text[], uuid, timestamptz, jsonb, text)
  to authenticated;

do $rollback$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'admin_taxonomy_rows',
        'admin_add_taxonomy_node',
        'admin_update_taxonomy_node',
        'admin_taxonomy_rows_v2',
        'admin_add_taxonomy_node_v2',
        'admin_update_taxonomy_node_v2'
      )
  ) then
    raise exception 'rollback would leave a privileged taxonomy implementation public';
  end if;
end;
$rollback$;

commit;
