-- 0090_private_public_seller_profile_implementation.sql
--
-- Remove direct API exposure of the public seller-profile SECURITY DEFINER
-- implementation without changing its RPC signature or result semantics.
-- The original implementation moves to private; a public SECURITY INVOKER
-- wrapper preserves anonymous and authenticated browser compatibility.

create temporary table findit_0090_expected_function (
  function_name text not null,
  identity_arguments text not null,
  result_type text not null,
  language_name text not null,
  volatility "char" not null,
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null,
  primary key (function_name, identity_arguments)
) on commit drop;

insert into findit_0090_expected_function values (
  'get_public_seller_profile',
  'seller_email text',
  'jsonb',
  'sql',
  's',
  '082229bceba5a21b0ea13b80a41c7a7c',
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
  if (select count(*) from findit_0090_expected_function) <> 1 then
    raise exception '0090 expected exactly one public seller-profile fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
  ) then
    raise exception '0090 refused because a private seller-profile implementation already exists';
  end if;

  select count(*)::integer into mismatch_count
  from findit_0090_expected_function expected
  left join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = expected.identity_arguments
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> expected.language_name
     or pg_get_function_result(function_record.oid) <> expected.result_type
     or function_record.provolatile <> expected.volatility
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0090 refused because the public seller-profile fingerprint drifted';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('get_public_seller_profile(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(caller.oid) = 'seller_email text'
    );

  if caller_count <> 0 then
    raise exception '0090 refused because % stored seller-profile callers exist', caller_count;
  end if;

  alter function public.get_public_seller_profile(text) set schema private;
  alter function private.get_public_seller_profile(text) set search_path = '';

  revoke all on function private.get_public_seller_profile(text) from public, anon, authenticated, service_role;
  grant execute on function private.get_public_seller_profile(text) to anon, authenticated, service_role;

  create function public.get_public_seller_profile(seller_email text)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.get_public_seller_profile(seller_email);
  $$;

  revoke all on function public.get_public_seller_profile(text) from public, anon, authenticated, service_role;
  grant execute on function public.get_public_seller_profile(text) to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[];

  if private_count <> 1 then
    raise exception '0090 did not create the locked private seller-profile implementation';
  end if;

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.get_public_seller_profile(seller_email)' in function_record.prosrc) > 0;

  if public_count <> 1 then
    raise exception '0090 did not create the locked public seller-profile wrapper';
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
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0090 left a PUBLIC execute grant on a seller-profile function';
  end if;

  if not (
    has_function_privilege('anon', 'public.get_public_seller_profile(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_public_seller_profile(text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.get_public_seller_profile(text)', 'EXECUTE')
    and has_function_privilege('anon', 'private.get_public_seller_profile(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.get_public_seller_profile(text)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.get_public_seller_profile(text)', 'EXECUTE')
  ) then
    raise exception '0090 did not preserve required seller-profile execution grants';
  end if;
end
$migration$;
