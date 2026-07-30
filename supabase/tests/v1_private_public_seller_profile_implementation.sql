begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
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
      and function_record.proconfig = array['search_path=""']::text[]
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '082229bceba5a21b0ea13b80a41c7a7c'
  ),
  1::bigint,
  'one locked SECURITY DEFINER seller-profile implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
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
      and position('private.get_public_seller_profile(seller_email)' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public seller-profile compatibility RPC is a locked SECURITY INVOKER wrapper'
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
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either seller-profile function identity'
);

select extensions.ok(
  has_function_privilege('anon', 'public.get_public_seller_profile(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_public_seller_profile(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_public_seller_profile(text)', 'EXECUTE'),
  'public seller-profile wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege('anon', 'private.get_public_seller_profile(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.get_public_seller_profile(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.get_public_seller_profile(text)', 'EXECUTE'),
  'private seller-profile implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('get_public_seller_profile(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname = 'public'
        and caller.proname = 'get_public_seller_profile'
        and pg_get_function_identity_arguments(caller.oid) = 'seller_email text'
      )
  ),
  0::bigint,
  'no stored function depends on the public seller-profile RPC identity'
);

set local role anon;

select extensions.is(
  public.get_public_seller_profile('missing-profile@example.invalid'),
  private.get_public_seller_profile('missing-profile@example.invalid'),
  'public seller-profile wrapper preserves private implementation semantics'
);

reset role;

select extensions.finish();
rollback;
