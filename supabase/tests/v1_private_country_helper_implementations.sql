begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
  ),
  3::bigint,
  'three locked SECURITY DEFINER country implementations live in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.' || function_record.proname || '(' in function_record.prosrc) > 0
  ),
  3::bigint,
  'three public compatibility functions are locked SECURITY INVOKER wrappers'
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
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on a country helper identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from (
      select 1
      from pg_proc caller
      join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
      where caller_schema.nspname = 'public'
        and caller.proname = 'public_listing_search_page'
        and position('public.is_country_browsable(' in caller.prosrc) > 0

      union all

      select 1
      from pg_proc caller
      join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
      where caller_schema.nspname = 'public'
        and caller.proname = 'create_v1_listing_submission'
        and position('public.is_country_publishable(' in caller.prosrc) > 0

      union all

      select 1
      from pg_proc caller
      join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
      where caller_schema.nspname = 'public'
        and caller.proname = 'create_v1_listing_submission'
        and position('public.is_supported_listing_currency(' in caller.prosrc) > 0

      union all

      select 1
      from pg_proc caller
      join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
      where caller_schema.nspname = 'public'
        and caller.proname = 'owner_transition_listing'
        and position('public.is_country_publishable(' in caller.prosrc) > 0
    ) expected_callers
  ),
  4::bigint,
  'all four stored country helper call paths remain public-compatible'
);

select extensions.ok(
  has_function_privilege('anon', 'public.is_country_browsable(text)', 'EXECUTE')
  and has_function_privilege('anon', 'private.is_country_browsable(text)', 'EXECUTE'),
  'anonymous country browsing retains wrapper and private execution privileges'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.is_country_publishable(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.is_country_publishable(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.is_supported_listing_currency(text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.is_supported_listing_currency(text,text)', 'EXECUTE'),
  'authenticated listing workflows retain wrapper and private execution privileges'
);

set local role anon;

select extensions.is(
  public.is_country_browsable('ZW'),
  private.is_country_browsable('ZW'),
  'public country browsing wrapper preserves private implementation semantics'
);

select extensions.is(
  public.is_country_publishable('ZW'),
  private.is_country_publishable('ZW'),
  'public country publishing wrapper preserves private implementation semantics'
);

select extensions.is(
  public.is_supported_listing_currency('ZW', 'USD'),
  private.is_supported_listing_currency('ZW', 'USD'),
  'public listing currency wrapper preserves private implementation semantics'
);

reset role;

select extensions.finish();
rollback;
