-- 20260808080900_taxonomy_function_privilege_boundary.rollback.sql
-- Safety rollback: restoring implicit PUBLIC EXECUTE would reintroduce a known
-- privilege defect. Preserve the least-privilege taxonomy capability boundary.

begin;

revoke all on function public.is_valid_taxonomy_aliases(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_synonyms(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_markets(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_localized_taxonomy_labels(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_taxonomy_aliases(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_synonyms(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_markets(text[]) to service_role;
grant execute on function public.is_valid_localized_taxonomy_labels(jsonb) to service_role;

revoke all on function public.enforce_listing_taxonomy_category() from public, anon, authenticated;
revoke all on function public.enforce_taxonomy_hierarchy_integrity() from public, anon, authenticated;
grant execute on function public.enforce_listing_taxonomy_category() to service_role;
grant execute on function public.enforce_taxonomy_hierarchy_integrity() to service_role;

revoke all on function public.taxonomy_terms_collide(text, uuid, text, text, text[])
  from public, anon, authenticated, service_role;

revoke all on function public.public_category_taxonomy(text) from public, service_role;
grant execute on function public.public_category_taxonomy(text) to anon, authenticated;
revoke all on function public.public_category_taxonomy_v2(text, text) from public, service_role;
grant execute on function public.public_category_taxonomy_v2(text, text) to anon, authenticated;
revoke all on function public.resolve_category_taxonomy(text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;
revoke all on function public.resolve_category_taxonomy(text, text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text, text) to anon, authenticated;

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

commit;
