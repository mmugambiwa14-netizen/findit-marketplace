-- 0093_private_marketplace_view_implementation.sql
--
-- Move the volatile marketplace view-counter SECURITY DEFINER implementation
-- into the non-exposed private schema. Preserve the public RPC signature and
-- all existing counter semantics through a SECURITY INVOKER wrapper.

create temporary table findit_0093_expected_function (
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0093_expected_function values (
  '16ed1360668ed6295a3d8ed0e219f55c',
  array['search_path=public']::text[],
  '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0093_expected_function) <> 1 then
    raise exception '0093 expected exactly one marketplace view fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
  ) then
    raise exception '0093 refused because a private marketplace view implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('record_marketplace_view(' in coalesce(policy.qual, '')) > 0
       or position('record_marketplace_view(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0093 refused because the marketplace view function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('record_marketplace_view(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(caller.oid) = 'p_parent_type text, p_parent_id uuid'
    );

  if caller_count <> 0 then
    raise exception '0093 refused because % stored marketplace view callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0093_expected_function expected
  left join pg_proc function_record
    on function_record.proname = 'record_marketplace_view'
   and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'plpgsql'
     or pg_get_function_result(function_record.oid) <> 'bigint'
     or function_record.provolatile <> 'v'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0093 refused because the marketplace view fingerprint drifted';
  end if;

  alter function public.record_marketplace_view(text, uuid) set schema private;
  alter function private.record_marketplace_view(text, uuid) set search_path = '';

  revoke all on function private.record_marketplace_view(text, uuid)
    from public, anon, authenticated, service_role;
  grant execute on function private.record_marketplace_view(text, uuid)
    to anon, authenticated, service_role;

  create function public.record_marketplace_view(
    p_parent_type text,
    p_parent_id uuid
  )
  returns bigint
  language sql
  volatile
  security invoker
  set search_path = ''
  as $$
    select private.record_marketplace_view(p_parent_type, p_parent_id);
  $$;

  revoke all on function public.record_marketplace_view(text, uuid)
    from public, anon, authenticated, service_role;
  grant execute on function public.record_marketplace_view(text, uuid)
    to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'record_marketplace_view'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
    and pg_get_function_result(function_record.oid) = 'bigint'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '16ed1360668ed6295a3d8ed0e219f55c';

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'record_marketplace_view'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
    and pg_get_function_result(function_record.oid) = 'bigint'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.record_marketplace_view(p_parent_type, p_parent_id)' in function_record.prosrc) > 0;

  if private_count <> 1 or public_count <> 1 then
    raise exception '0093 did not create the locked marketplace view boundary';
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
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0093 left a PUBLIC execute grant on a marketplace view function';
  end if;

  if not (
    has_function_privilege('anon', 'public.record_marketplace_view(text,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.record_marketplace_view(text,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_marketplace_view(text,uuid)', 'EXECUTE')
    and has_function_privilege('anon', 'private.record_marketplace_view(text,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.record_marketplace_view(text,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.record_marketplace_view(text,uuid)', 'EXECUTE')
  ) then
    raise exception '0093 did not preserve required marketplace view execution grants';
  end if;
end
$migration$;
