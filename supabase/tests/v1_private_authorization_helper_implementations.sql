begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=']::text[]
  ),
  3::bigint,
  'three locked SECURITY DEFINER authorization implementations live in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=']::text[]
      and position('private.' || function_record.proname || '()' in function_record.prosrc) > 0
  ),
  3::bigint,
  'three public compatibility functions are stable SECURITY INVOKER wrappers'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and function_record.prosecdef
  ),
  0::bigint,
  'no exposed authorization helper remains SECURITY DEFINER'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC has no execute grant on authorization helpers or wrappers'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join unnest(array['anon', 'authenticated', 'service_role']) role_name
    where function_schema.nspname in ('public', 'private')
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
      and has_function_privilege(role_name, function_record.oid, 'EXECUTE')
  ),
  18::bigint,
  'anon, authenticated and service-role callers retain the six required execution paths'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('private.is_active_user()' in coalesce(policy.qual, '')) > 0
       or position('private.is_active_user()' in coalesce(policy.with_check, '')) > 0
  ),
  27::bigint,
  'all 27 active-user policies remain attached to the private implementation'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('private.is_admin()' in coalesce(policy.qual, '')) > 0
       or position('private.is_admin()' in coalesce(policy.with_check, '')) > 0
  ),
  75::bigint,
  'all 75 admin policies remain attached to the private implementation'
);

set local role anon;
select public.is_active_user();
select public.is_admin();
select public.is_super_admin();
reset role;
select extensions.pass('anonymous callers can invoke the compatibility wrappers without elevated execution');

set local role authenticated;
select public.is_active_user();
select public.is_admin();
select public.is_super_admin();
reset role;
select extensions.pass('authenticated callers can invoke the compatibility wrappers without elevated execution');

select extensions.finish();
rollback;
