begin;

-- Six functions in public and private were created without any explicit
-- privilege statement, so they still carry the default ACL, which grants
-- EXECUTE to PUBLIC. Three of them are peek trigger functions and one is a peek
-- ownership assertion, all in private; until 20260806120000 restored schema
-- USAGE they were unreachable regardless, so closing them now is part of that
-- change rather than a separate concern.
--
-- The grant is removed from PUBLIC only. Where a concrete role legitimately
-- reaches a function today, that access is re-granted explicitly, so nothing
-- that works now stops working. The two public helpers back CHECK constraints,
-- so their browser roles keep EXECUTE rather than relying on how PostgreSQL
-- resolves privileges inside a constraint expression.

revoke all on function private.assert_peek_parent_owner(uuid, uuid, uuid) from public;
revoke all on function private.reject_response_peek_in_slot() from public;
revoke all on function private.sync_peek_request_supporter_count() from public;
revoke all on function private.touch_peek_request() from public;

revoke all on function public.is_valid_attribute_document(jsonb) from public;
revoke all on function public.jsonb_values_are_http_urls(jsonb) from public;
grant execute on function public.is_valid_attribute_document(jsonb) to anon, authenticated, service_role;
grant execute on function public.jsonb_values_are_http_urls(jsonb) to anon, authenticated, service_role;

-- 0110 and 0111 only narrowed the schema-public default privileges: 0110 removed
-- truncate, trigger and references from both browser roles, 0111 removed insert,
-- update and delete from anon. SELECT still reaches every new public table, so
-- web_push_delivery_jobs was created carrying browser grants. Row level security
-- is enabled on it with no policies, so it already denies every row, but a table
-- holding push subscription delivery state should not be reachable at all.
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
    raise exception
      '20260806140000 left an EXECUTE grant to PUBLIC on a public or private function';
  end if;

  if has_table_privilege('anon', 'public.web_push_delivery_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'public.web_push_delivery_jobs', 'SELECT') then
    raise exception
      '20260806140000 left web_push_delivery_jobs reachable from a browser role';
  end if;
end;
$migration$;

commit;
