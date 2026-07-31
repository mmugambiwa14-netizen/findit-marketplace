begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'no authenticated-callable SECURITY DEFINER function remains in public'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
  ),
  57::bigint,
  'all 57 public compatibility wrappers exist'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_proc implementation
      on implementation.proname = wrapper.proname
     and pg_get_function_identity_arguments(implementation.oid) = pg_get_function_identity_arguments(wrapper.oid)
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and implementation.prosecdef
  ),
  57::bigint,
  'all wrappers have private privileged implementations'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_language language on language.oid = wrapper.prolang
    where wrapper_schema.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and language.lanname = 'sql'
      and not wrapper.prosecdef
      and wrapper.proconfig = array['search_path=""']::text[]
      and position('private.' || wrapper.proname || '(' in wrapper.prosrc) > 0
  ),
  57::bigint,
  'all public wrappers are invoker SQL functions with an empty search path'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_proc implementation
      on implementation.proname = wrapper.proname
     and pg_get_function_identity_arguments(implementation.oid) = pg_get_function_identity_arguments(wrapper.oid)
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and pg_get_function_result(wrapper.oid) = pg_get_function_result(implementation.oid)
      and wrapper.provolatile = implementation.provolatile
      and wrapper.proretset = implementation.proretset
      and wrapper.proisstrict = implementation.proisstrict
      and wrapper.proparallel = implementation.proparallel
      and wrapper.procost = implementation.procost
      and wrapper.prorows = implementation.prorows
      and wrapper.pronargdefaults = implementation.pronargdefaults
  ),
  57::bigint,
  'wrapper results, defaults and execution planner attributes match implementations'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
  ),
  57::bigint,
  'authenticated retains every public RPC grant'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc implementation
    join pg_namespace n on n.oid = implementation.pronamespace
    where n.nspname = 'private'
      and exists (
        select 1
        from pg_proc wrapper
        join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
        where wrapper_schema.nspname = 'public'
          and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
          and wrapper.proname = implementation.proname
          and pg_get_function_identity_arguments(wrapper.oid) = pg_get_function_identity_arguments(implementation.oid)
      )
      and has_function_privilege('authenticated', implementation.oid, 'EXECUTE')
  ),
  57::bigint,
  'authenticated can traverse each invoker wrapper to its private implementation'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and has_function_privilege('service_role', wrapper.oid, 'EXECUTE')
  ),
  53::bigint,
  'service-role public grants preserve the original 53-function matrix'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc implementation
    join pg_namespace n on n.oid = implementation.pronamespace
    where n.nspname = 'private'
      and exists (
        select 1
        from pg_proc wrapper
        join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
        where wrapper_schema.nspname = 'public'
          and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
          and wrapper.proname = implementation.proname
          and pg_get_function_identity_arguments(wrapper.oid) = pg_get_function_identity_arguments(implementation.oid)
      )
      and has_function_privilege('service_role', implementation.oid, 'EXECUTE')
  ),
  53::bigint,
  'service-role private grants preserve the original 53-function matrix'
);

select extensions.is(
  (
    select array_agg(wrapper.proname order by wrapper.proname)
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and not has_function_privilege('service_role', wrapper.oid, 'EXECUTE')
  ),
  array[
    'admin_purge_recommendation_service_cache_v1',
    'admin_recommendation_analytics_v1',
    'admin_update_recommendation_service_policy_v1',
    'admin_upsert_recommendation_context_rule_v1'
  ]::name[],
  'the four authenticated-only recommendation admin RPCs remain service-role closed'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and has_function_privilege('anon', wrapper.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute any authenticated wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc implementation
    join pg_namespace n on n.oid = implementation.pronamespace
    where n.nspname = 'private'
      and exists (
        select 1
        from pg_proc wrapper
        join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
        where wrapper_schema.nspname = 'public'
          and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
          and wrapper.proname = implementation.proname
          and pg_get_function_identity_arguments(wrapper.oid) = pg_get_function_identity_arguments(implementation.oid)
      )
      and has_function_privilege('anon', implementation.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute any target private implementation'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    cross join lateral aclexplode(coalesce(wrapper.proacl, acldefault('f', wrapper.proowner))) privilege
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC has no execute privilege on the wrappers'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and wrapper.proname in (
        'owner_listing_notes',
        'message_inbox_page',
        'notification_rows_page',
        'create_v1_listing_submission',
        'admin_user_rows_page'
      )
  ),
  5::bigint,
  'representative owner, messaging, notification, submission and admin RPCs are wrapped'
);

set local role anon;
select extensions.throws_ok(
  $$select * from public.owner_listing_notes(array['00000000-0000-0000-0000-000000000001'::uuid])$$,
  '42501',
  null,
  'anon is denied before owner listing notes executes'
);
reset role;

select * from extensions.finish();
rollback;
