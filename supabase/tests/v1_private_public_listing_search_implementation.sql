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
      and function_record.proname = 'public_listing_search_page'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
      and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.pronargdefaults = 14
      and function_record.proconfig = array['search_path=""']::text[]
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '2fa173e978e3d5142ef72c6266e9dc20'
  ),
  1::bigint,
  'one exact stable public listing search implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'public_listing_search_page'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
      and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.pronargdefaults = 14
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.public_listing_search_page(' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public stable invoker wrapper preserves fourteen defaults and the 31-column result'
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
      and function_record.proname = 'public_listing_search_page'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either listing search function'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  ),
  'public listing search wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'private.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  ),
  'private listing search implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('public_listing_search_page(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname in ('public', 'private')
        and caller.proname = 'public_listing_search_page'
      )
  ),
  0::bigint,
  'no stored function depends on the public search identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('public_listing_search_page(' in coalesce(policy.qual, '')) > 0
       or position('public_listing_search_page(' in coalesce(policy.with_check, '')) > 0
  ),
  0::bigint,
  'no RLS policy depends on the public search identity'
);

set local role anon;
select extensions.throws_ok(
  $$select * from public.public_listing_search_page('unsupported')$$,
  '22023',
  'invalid public listing search page',
  'public wrapper preserves all defaults and input validation'
);
select extensions.throws_ok(
  $$select * from private.public_listing_search_page('unsupported')$$,
  '22023',
  'invalid public listing search page',
  'private implementation preserves all defaults and validation'
);
reset role;

select * from extensions.finish();
rollback;
