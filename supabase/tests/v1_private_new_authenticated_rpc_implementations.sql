begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
    ) + (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-trigger-boundary'
    )
  )::bigint,
  22::bigint,
  'all 22 newer privileged functions are classified as RPCs or internal triggers'
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
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and implementation.prosecdef
  ),
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  'every newer RPC wrapper has a private privileged implementation'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_language language on language.oid = wrapper.prolang
    where wrapper_schema.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and language.lanname = 'sql'
      and not wrapper.prosecdef
      and wrapper.proconfig = array['search_path=""']::text[]
      and position('private.' || wrapper.proname || '(' in wrapper.prosrc) > 0
  ),
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  'all newer public RPC wrappers are invoker SQL functions with an empty search path'
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
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and pg_get_function_result(wrapper.oid) = pg_get_function_result(implementation.oid)
      and wrapper.provolatile = implementation.provolatile
      and wrapper.proretset = implementation.proretset
      and wrapper.proisstrict = implementation.proisstrict
      and wrapper.proparallel = implementation.proparallel
      and wrapper.procost = implementation.procost
      and wrapper.prorows = implementation.prorows
      and wrapper.pronargdefaults = implementation.pronargdefaults
  ),
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  'newer RPC wrapper results, defaults and planner attributes match implementations'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
  ),
  (
    select count(*)::bigint
    from pg_proc wrapper
    join pg_namespace n on n.oid = wrapper.pronamespace
    where n.nspname = 'public'
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  'authenticated can execute every newer public RPC wrapper'
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
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and (
        has_function_privilege('anon', wrapper.oid, 'EXECUTE') <> has_function_privilege('anon', implementation.oid, 'EXECUTE')
        or has_function_privilege('authenticated', wrapper.oid, 'EXECUTE') <> has_function_privilege('authenticated', implementation.oid, 'EXECUTE')
        or has_function_privilege('service_role', wrapper.oid, 'EXECUTE') <> has_function_privilege('service_role', implementation.oid, 'EXECUTE')
      )
  ),
  0::bigint,
  'newer RPC wrapper and implementation named-role grants match'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-trigger-boundary'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ),
  0::bigint,
  'internal trigger implementations are closed to all client roles'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname in ('public', 'private')
      and obj_description(p.oid, 'pg_proc') in (
        'findit:20260805073000-authenticated-boundary',
        'findit:20260805073000-trigger-boundary'
      )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC has no execute privilege on newer wrappers or implementations'
);

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
  'the complete public authenticated RPC surface remains invoker-only'
);

select * from extensions.finish();
rollback;
