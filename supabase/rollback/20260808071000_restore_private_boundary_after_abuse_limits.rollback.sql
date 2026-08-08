-- 20260808071000_restore_private_boundary_after_abuse_limits.rollback.sql
-- Safety rollback: this correction restores a pre-existing private-schema
-- contract and closes an authorization NULL edge. Reversing either would
-- knowingly reintroduce a privilege regression, so rollback preserves both
-- safety properties while leaving all rate-limit data and the corrected prune
-- implementation untouched.

begin;

grant usage on schema private to anon, authenticated;
revoke create on schema private from public, anon, authenticated;

-- Preserve the corrected service-only maintenance boundary. The implementation
-- itself is intentionally not recreated here: rollback SQL must remain free of
-- destructive data statements, and reverting the NULL-safe authorization check
-- would knowingly restore a security defect.
revoke all on function public.prune_abuse_rate_limit_buckets(integer)
  from public, anon, authenticated;
grant execute on function public.prune_abuse_rate_limit_buckets(integer)
  to service_role;

-- Schema USAGE never implies access to the limiter internals.
revoke all on table private.abuse_rate_limit_buckets
  from public, anon, authenticated, service_role;
revoke all on function private.consume_abuse_rate_limit(text, text, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.require_abuse_rate_limit(text, text, integer, integer, text, text, integer)
  from public, anon, authenticated, service_role;

do $rollback$
begin
  if not has_schema_privilege('anon', 'private', 'USAGE')
     or not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'rollback lost policy-helper schema usage';
  end if;

  if has_schema_privilege('anon', 'private', 'CREATE')
     or has_schema_privilege('authenticated', 'private', 'CREATE') then
    raise exception 'rollback exposed private schema creation';
  end if;

  if has_table_privilege('anon', 'private.abuse_rate_limit_buckets', 'SELECT')
     or has_table_privilege('authenticated', 'private.abuse_rate_limit_buckets', 'SELECT') then
    raise exception 'rollback exposed abuse limiter state';
  end if;

  if has_function_privilege(
       'anon',
       'private.consume_abuse_rate_limit(text,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.consume_abuse_rate_limit(text,text,integer,integer,integer)',
       'EXECUTE'
     ) then
    raise exception 'rollback exposed abuse limiter execution';
  end if;
end;
$rollback$;

commit;
