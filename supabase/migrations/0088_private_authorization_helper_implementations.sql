-- 0088_private_authorization_helper_implementations.sql
--
-- Remove direct API exposure of the three core authorization SECURITY DEFINER
-- functions without changing their public signatures or caller semantics.
-- Existing policy dependencies follow the original function OIDs into private;
-- compatibility wrappers remain in public as SECURITY INVOKER functions.

create temporary table findit_0088_expected_functions (
  function_name text primary key,
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0088_expected_functions values
  (
    'is_active_user',
    '7f1fa376e4c9bd15729774228ee05612',
    array['search_path=public']::text[],
    '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  ),
  (
    'is_admin',
    'e4840ed30b29001f36142fcc40a0235a',
    array['search_path=public, extensions']::text[],
    '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  ),
  (
    'is_super_admin',
    '8f6ed50c6a3a132125f6f3f3912797f2',
    array['search_path=public, extensions']::text[],
    '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  );

create temporary table findit_0088_policy_dependencies (
  helper_name text not null,
  schema_name text not null,
  table_name text not null,
  policy_name text not null,
  primary key (helper_name, schema_name, table_name, policy_name)
) on commit drop;

insert into findit_0088_policy_dependencies
select
  'is_active_user',
  policy.schemaname,
  policy.tablename,
  policy.policyname
from pg_policies policy
where position('is_active_user()' in coalesce(policy.qual, '')) > 0
   or position('is_active_user()' in coalesce(policy.with_check, '')) > 0;

insert into findit_0088_policy_dependencies
select
  'is_admin',
  policy.schemaname,
  policy.tablename,
  policy.policyname
from pg_policies policy
where position('is_admin()' in coalesce(policy.qual, '')) > 0
   or position('is_admin()' in coalesce(policy.with_check, '')) > 0;

do $migration$
declare
  mismatch_count integer;
  public_count integer;
  private_count integer;
  policy_count integer;
begin
  if (select count(*) from findit_0088_expected_functions) <> 3 then
    raise exception '0088 expected exactly three authorization helper fingerprints';
  end if;

  if (select count(*) from findit_0088_policy_dependencies where helper_name = 'is_active_user') <> 27 then
    raise exception '0088 expected exactly 27 active-user policy dependencies';
  end if;

  if (select count(*) from findit_0088_policy_dependencies where helper_name = 'is_admin') <> 75 then
    raise exception '0088 expected exactly 75 admin policy dependencies';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
  ) then
    raise exception '0088 refused because a private authorization helper already exists';
  end if;

  select count(*)::integer into mismatch_count
  from findit_0088_expected_functions expected
  left join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = ''
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'sql'
     or pg_get_function_result(function_record.oid) <> 'boolean'
     or function_record.provolatile <> 's'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0088 refused because % authorization helper fingerprints drifted', mismatch_count;
  end if;

  alter function public.is_active_user() set schema private;
  alter function public.is_admin() set schema private;
  alter function public.is_super_admin() set schema private;

  alter function private.is_active_user() set search_path = '';
  alter function private.is_admin() set search_path = '';
  alter function private.is_super_admin() set search_path = '';

  revoke all on function private.is_active_user() from public, anon, authenticated, service_role;
  grant execute on function private.is_active_user() to anon, authenticated, service_role;

  revoke all on function private.is_admin() from public, anon, authenticated, service_role;
  grant execute on function private.is_admin() to anon, authenticated, service_role;

  revoke all on function private.is_super_admin() from public, anon, authenticated, service_role;
  grant execute on function private.is_super_admin() to anon, authenticated, service_role;

  create function public.is_active_user()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_active_user();
  $$;

  create function public.is_admin()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_admin();
  $$;

  create function public.is_super_admin()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_super_admin();
  $$;

  revoke all on function public.is_active_user() from public, anon, authenticated, service_role;
  grant execute on function public.is_active_user() to anon, authenticated, service_role;

  revoke all on function public.is_admin() from public, anon, authenticated, service_role;
  grant execute on function public.is_admin() to anon, authenticated, service_role;

  revoke all on function public.is_super_admin() from public, anon, authenticated, service_role;
  grant execute on function public.is_super_admin() to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
    and pg_get_function_identity_arguments(function_record.oid) = ''
    and function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[];

  if private_count <> 3 then
    raise exception '0088 created only % of three locked private implementations', private_count;
  end if;

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
    and pg_get_function_identity_arguments(function_record.oid) = ''
    and not function_record.prosecdef
    and function_record.proconfig = array['search_path=""']::text[];

  if public_count <> 3 then
    raise exception '0088 created only % of three public invoker wrappers', public_count;
  end if;

  if exists (
    select 1
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
  ) then
    raise exception '0088 left a PUBLIC execute grant on an authorization helper';
  end if;

  select count(*)::integer into policy_count
  from findit_0088_policy_dependencies dependency
  join pg_policies policy
    on policy.schemaname = dependency.schema_name
   and policy.tablename = dependency.table_name
   and policy.policyname = dependency.policy_name
  where (
    dependency.helper_name = 'is_active_user'
    and (
      position('private.is_active_user()' in coalesce(policy.qual, '')) > 0
      or position('private.is_active_user()' in coalesce(policy.with_check, '')) > 0
    )
  ) or (
    dependency.helper_name = 'is_admin'
    and (
      position('private.is_admin()' in coalesce(policy.qual, '')) > 0
      or position('private.is_admin()' in coalesce(policy.with_check, '')) > 0
    )
  );

  if policy_count <> 102 then
    raise exception '0088 preserved only % of 102 private policy dependencies', policy_count;
  end if;
end
$migration$;
