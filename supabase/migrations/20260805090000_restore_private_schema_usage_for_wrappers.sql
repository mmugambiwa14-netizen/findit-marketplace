begin;

-- Restore USAGE on schema private for the PostgREST client roles.
-- Public security-invoker wrappers delegate into explicitly granted private
-- implementations. They need schema USAGE, while CREATE remains revoked.
grant usage on schema private to anon, authenticated;

do $migration$
declare
  private_acl text;
  broken_wrappers integer;
begin
  select coalesce(nspacl::text, '') into private_acl
  from pg_namespace where nspname = 'private';

  if private_acl not like '%anon=U/%' or private_acl not like '%authenticated=U/%' then
    raise exception 'private schema USAGE was not restored: %', private_acl;
  end if;

  if private_acl like '%anon=UC/%' or private_acl like '%authenticated=UC/%' then
    raise exception 'private schema CREATE must stay revoked: %', private_acl;
  end if;

  select count(*)::integer into broken_wrappers
  from pg_proc wrapper
  join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
  where wrapper_schema.nspname = 'public'
    and not wrapper.prosecdef
    and wrapper.prosrc ~ 'private\.'
    and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
    and not has_schema_privilege('authenticated', 'private', 'USAGE');

  if broken_wrappers <> 0 then
    raise exception '% public wrappers remain unreachable through the private boundary', broken_wrappers;
  end if;
end
$migration$;

commit;
