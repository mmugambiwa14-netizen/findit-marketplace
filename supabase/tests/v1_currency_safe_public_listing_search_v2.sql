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
      and function_record.proname = 'public_listing_search_page_v2'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_kind text, p_country_code text, p_currency text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
  ),
  1::bigint,
  'one private stable currency-safe listing search implementation exists'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'public_listing_search_page_v2'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_kind text, p_country_code text, p_currency text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
      and position('private.public_listing_search_page_v2(' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public security-invoker v2 wrapper exists'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'public_listing_search_page_v2'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'v2 leaves no PUBLIC execute grant'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'public.public_listing_search_page_v2(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.public_listing_search_page_v2(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.public_listing_search_page_v2(text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  ),
  'v2 public wrapper is callable by browser and service roles'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.public_listing_search_page(text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,uuid,integer)',
    'EXECUTE'
  ),
  'legacy v1 search is retained for service rollback but retired from browsers'
);

select extensions.ok(
  (
    select position('listing.public_latitude' in function_record.prosrc) > 0
      and position('listing.public_longitude' in function_record.prosrc) > 0
      and position('listing.content_suspended_at is null' in function_record.prosrc) > 0
      and position('listing.native_currency' in function_record.prosrc) > 0
      and position('listing.native_price' in function_record.prosrc) > 0
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'public_listing_search_page_v2'
  ),
  'v2 implementation uses public location, native currency and suspension boundaries'
);

select extensions.ok(
  (
    select position('contact_phone text' in pg_get_function_result(function_record.oid)) = 0
      and position('contact_whatsapp text' in pg_get_function_result(function_record.oid)) = 0
      and position('contact_email text' in pg_get_function_result(function_record.oid)) = 0
      and position('has_contact_phone boolean' in pg_get_function_result(function_record.oid)) > 0
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname = 'public_listing_search_page_v2'
  ),
  'v2 result exposes contact availability but not raw seller contact values'
);

select extensions.ok(
  to_regclass('public.idx_listings_public_currency_price_asc') is not null
  and to_regclass('public.idx_listings_public_currency_price_desc') is not null,
  'currency-scoped public price indexes exist'
);

set local role anon;

select extensions.throws_ok(
  $$select * from public.public_listing_search_page_v2(p_kind => 'property', p_country_code => 'ZW', p_sort => 'price_asc')$$,
  '22023',
  'invalid public listing search v2 page',
  'price sorting requires an explicit currency'
);

select extensions.throws_ok(
  $$select * from public.public_listing_search_page_v2(p_kind => 'property', p_country_code => 'ZW', p_currency => 'EUR')$$,
  '22023',
  'invalid public listing search v2 currency',
  'unsupported listing currency is rejected'
);

select extensions.throws_ok(
  $$select * from public.public_listing_search_page_v2(p_kind => 'property', p_country_code => 'ZW', p_min_price => 100)$$,
  '22023',
  'invalid public listing search v2 page',
  'price bounds without a currency are rejected'
);

select extensions.lives_ok(
  $$select count(*) from public.public_listing_search_page_v2(p_kind => 'property', p_country_code => 'ZW', p_sort => 'newest')$$,
  'all-currency newest browsing remains public and bounded'
);

reset role;

select * from extensions.finish();
rollback;
