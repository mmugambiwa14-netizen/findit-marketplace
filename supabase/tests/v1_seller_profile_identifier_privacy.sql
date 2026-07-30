begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and pg_get_function_result(function_record.oid) = 'jsonb'
      and function_record.provolatile = 's'
      and function_record.prosecdef
      and function_record.proconfig = array['search_path=""']::text[]
      and position('seller.id = p_seller_id' in function_record.prosrc) > 0
      and position('seller.status = ''active''' in function_record.prosrc) > 0
      and position('listing.status in (''available'', ''under_offer'')' in function_record.prosrc) > 0
      and position('listing.content_suspended_at is null' in function_record.prosrc) > 0
      and position('private.is_country_browsable(' in function_record.prosrc) > 0
      and position('seller.email' in function_record.prosrc) = 0
  ),
  1::bigint,
  'one UUID-only eligible-seller SECURITY DEFINER implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and pg_get_function_result(function_record.oid) = 'jsonb'
      and function_record.provolatile = 's'
      and not function_record.prosecdef
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.get_public_seller_profile(p_seller_id)' in function_record.prosrc) > 0
  ),
  1::bigint,
  'public seller profile RPC is a locked SECURITY INVOKER UUID wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    where function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
  ),
  0::bigint,
  'no account-email seller profile function remains'
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
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on the seller profile boundary'
);

select extensions.ok(
  has_function_privilege('anon', 'public.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('anon', 'private.get_public_seller_profile(uuid)', 'EXECUTE'),
  'anonymous public seller pages retain wrapper and private execution privileges'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.get_public_seller_profile(uuid)', 'EXECUTE'),
  'authenticated public seller pages retain wrapper and private execution privileges'
);

set local role anon;

select extensions.is(
  public.get_public_seller_profile(null::uuid),
  null::jsonb,
  'null seller IDs fail closed without exposing account data'
);

select extensions.is(
  public.get_public_seller_profile('00000000-0000-4000-8000-000000000000'::uuid),
  null::jsonb,
  'unknown seller IDs fail closed without exposing account data'
);

reset role;

select extensions.finish();
rollback;
