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
      and function_record.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
      and pg_get_function_result(function_record.oid) = 'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '3e72ef0e86cc539ee9f87ba6173def30'
  ),
  1::bigint,
  'one locked SECURITY DEFINER Tour-summary implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
      and pg_get_function_result(function_record.oid) = 'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.public_tour_summaries(p_listing_ids, p_service_ids)' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public Tour-summary compatibility RPC is a locked SECURITY INVOKER wrapper'
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
      and function_record.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either Tour-summary function'
);

select extensions.ok(
  has_function_privilege('anon', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
  and has_function_privilege('service_role', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE'),
  'public Tour-summary wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege('anon', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
  and has_function_privilege('service_role', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE'),
  'private Tour-summary implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('public_tour_summaries(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname in ('public', 'private')
        and caller.proname = 'public_tour_summaries'
        and pg_get_function_identity_arguments(caller.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
      )
  ),
  0::bigint,
  'no stored function depends on the public Tour-summary RPC identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('public_tour_summaries(' in coalesce(policy.qual, '')) > 0
       or position('public_tour_summaries(' in coalesce(policy.with_check, '')) > 0
  ),
  0::bigint,
  'no RLS policy depends on the public Tour-summary RPC identity'
);

set local role anon;

select extensions.is(
  (select count(*)::bigint from public.public_tour_summaries(null::uuid[], null::uuid[])),
  0::bigint,
  'anonymous null parent arrays remain a safe empty Tour-summary request'
);

select extensions.is(
  (select count(*)::bigint from private.public_tour_summaries(array[]::uuid[], array[]::uuid[])),
  0::bigint,
  'anonymous direct private execution preserves empty-array semantics required by the wrapper'
);

select extensions.throws_ok(
  $$
    select *
    from public.public_tour_summaries(
      array_fill('00000000-0000-4000-8000-000000000001'::uuid, array[101]),
      array[]::uuid[]
    )
  $$,
  '22023',
  'too many Tour parents requested',
  'public Tour-summary wrapper preserves the 100-listing parent ceiling'
);

select extensions.throws_ok(
  $$
    select *
    from public.public_tour_summaries(
      array[]::uuid[],
      array_fill('00000000-0000-4000-8000-000000000001'::uuid, array[101])
    )
  $$,
  '22023',
  'too many Tour parents requested',
  'public Tour-summary wrapper preserves the 100-service parent ceiling'
);

reset role;

select extensions.finish();
rollback;
