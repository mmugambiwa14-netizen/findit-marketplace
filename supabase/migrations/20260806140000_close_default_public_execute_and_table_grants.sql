begin;

revoke all on function private.assert_peek_parent_owner(uuid, uuid, uuid) from public;
revoke all on function private.reject_response_peek_in_slot() from public;
revoke all on function private.sync_peek_request_supporter_count() from public;
revoke all on function private.touch_peek_request() from public;

revoke all on function public.is_valid_attribute_document(jsonb) from public;
revoke all on function public.jsonb_values_are_http_urls(jsonb) from public;
grant execute on function public.is_valid_attribute_document(jsonb) to anon, authenticated, service_role;
grant execute on function public.jsonb_values_are_http_urls(jsonb) to anon, authenticated, service_role;

revoke all on table public.web_push_delivery_jobs from anon, authenticated;

do $migration$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname in ('public', 'private')
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'an EXECUTE grant to PUBLIC remains on a public or private function';
  end if;

  if has_table_privilege('anon', 'public.web_push_delivery_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'public.web_push_delivery_jobs', 'SELECT') then
    raise exception 'web_push_delivery_jobs remains reachable from a browser role';
  end if;
end;
$migration$;

commit;
