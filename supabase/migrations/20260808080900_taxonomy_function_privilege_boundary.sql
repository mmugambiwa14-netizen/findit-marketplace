-- 20260808080900_taxonomy_function_privilege_boundary.sql
-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default.
-- The repository security contract forbids that implicit capability. Close the
-- taxonomy helper surface explicitly and expose only the intended read/admin
-- RPCs to browser roles.

begin;

-- Pure validators are used by table constraints and trusted maintenance paths,
-- not as browser RPCs.
revoke all on function public.is_valid_taxonomy_aliases(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_synonyms(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_markets(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_localized_taxonomy_labels(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_taxonomy_aliases(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_synonyms(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_markets(text[]) to service_role;
grant execute on function public.is_valid_localized_taxonomy_labels(jsonb) to service_role;

-- Trigger implementations are not browser APIs. Service-role EXECUTE supports
-- trusted direct maintenance/import paths while ordinary listing/category writes
-- continue through their established RPC/table boundaries.
revoke all on function public.enforce_listing_taxonomy_category() from public, anon, authenticated;
revoke all on function public.enforce_taxonomy_hierarchy_integrity() from public, anon, authenticated;
grant execute on function public.enforce_listing_taxonomy_category() to service_role;
grant execute on function public.enforce_taxonomy_hierarchy_integrity() to service_role;

-- Collision detection is an internal SECURITY DEFINER helper called by the
-- guarded admin functions only.
revoke all on function public.taxonomy_terms_collide(text, uuid, text, text, text[])
  from public, anon, authenticated, service_role;

-- Marketplace read APIs: browser-readable, never PUBLIC by inheritance.
revoke all on function public.public_category_taxonomy(text) from public, service_role;
grant execute on function public.public_category_taxonomy(text) to anon, authenticated;

revoke all on function public.public_category_taxonomy_v2(text, text) from public, service_role;
grant execute on function public.public_category_taxonomy_v2(text, text) to anon, authenticated;

revoke all on function public.resolve_category_taxonomy(text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;

revoke all on function public.resolve_category_taxonomy(text, text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text, text) to anon, authenticated;

-- Admin APIs require an authenticated entry point and perform their own admin
-- authorization/reason checks. Anonymous/service callers receive no direct API.
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

do $boundary$
declare
  public_execute_count integer;
begin
  select count(*)::integer into public_execute_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
  where n.nspname = 'public'
    and p.proname in (
      'is_valid_taxonomy_aliases',
      'is_valid_taxonomy_synonyms',
      'is_valid_taxonomy_markets',
      'is_valid_localized_taxonomy_labels',
      'enforce_listing_taxonomy_category',
      'enforce_taxonomy_hierarchy_integrity',
      'taxonomy_terms_collide',
      'public_category_taxonomy',
      'public_category_taxonomy_v2',
      'resolve_category_taxonomy',
      'admin_taxonomy_rows',
      'admin_add_taxonomy_node',
      'admin_update_taxonomy_node',
      'admin_taxonomy_rows_v2',
      'admin_add_taxonomy_node_v2',
      'admin_update_taxonomy_node_v2'
    )
    and privilege.grantee = 0
    and privilege.privilege_type = 'EXECUTE';

  if public_execute_count <> 0 then
    raise exception 'taxonomy function PUBLIC EXECUTE grants remain: %', public_execute_count;
  end if;

  if not has_function_privilege('anon', 'public.public_category_taxonomy_v2(text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.public_category_taxonomy_v2(text,text)', 'EXECUTE') then
    raise exception 'public taxonomy read capability is missing';
  end if;

  if has_function_privilege('anon', 'public.admin_taxonomy_rows_v2()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_taxonomy_rows_v2()', 'EXECUTE') then
    raise exception 'taxonomy admin capability boundary is invalid';
  end if;
end;
$boundary$;

commit;
