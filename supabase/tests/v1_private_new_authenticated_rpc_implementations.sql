begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table expected_new_authenticated_rpcs (
  function_oid regprocedure primary key,
  anon_execute boolean not null
) on commit drop;

insert into expected_new_authenticated_rpcs(function_oid, anon_execute)
values
  ('public.bind_response_peek(uuid,uuid[])'::regprocedure, false),
  ('public.create_peek_request(uuid,uuid,public.peek_request_category,text)'::regprocedure, false),
  ('public.decline_peek_request(uuid,text)'::regprocedure, false),
  ('public.disable_web_push_subscription(text)'::regprocedure, false),
  ('public.merge_peek_request(uuid,uuid)'::regprocedure, false),
  ('public.my_peek_request_ids(uuid[])'::regprocedure, false),
  ('public.owner_listing_contacts(uuid[])'::regprocedure, false),
  ('public.owner_service_contacts(uuid[])'::regprocedure, false),
  ('public.peek_thread_page(uuid,uuid,text,text,integer,timestamptz,uuid,integer)'::regprocedure, true),
  ('public.prepare_own_account_deletion(text)'::regprocedure, false),
  ('public.public_response_peek_metadata(uuid)'::regprocedure, true),
  ('public.public_tour_view_counts(uuid[])'::regprocedure, true),
  ('public.queue_response_peek_binding(uuid,uuid)'::regprocedure, false),
  ('public.record_public_tour_view(uuid,uuid)'::regprocedure, true),
  ('public.register_web_push_subscription(text,text,text,text,text)'::regprocedure, false),
  ('public.response_peek_request_candidates(uuid)'::regprocedure, false),
  ('public.reveal_listing_contact(uuid)'::regprocedure, false),
  ('public.reveal_service_contact(uuid)'::regprocedure, false),
  ('public.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure, false),
  ('public.seller_unbound_response_peeks()'::regprocedure, false),
  ('public.support_peek_request(uuid)'::regprocedure, false),
  ('public.withdraw_peek_request_support(uuid)'::regprocedure, false);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  22::bigint,
  'all 22 newer public compatibility wrappers exist'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_new_authenticated_rpcs expected
    where obj_description(expected.function_oid::oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
  ),
  22::bigint,
  'the exact locked RPC identities carry the newer boundary marker'
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
  22::bigint,
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
  22::bigint,
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
  22::bigint,
  'newer RPC wrapper results, defaults and planner attributes match implementations'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_new_authenticated_rpcs expected
    where has_function_privilege('authenticated', expected.function_oid, 'EXECUTE')
  ),
  22::bigint,
  'authenticated can execute every newer public RPC wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_new_authenticated_rpcs expected
    where has_function_privilege('service_role', expected.function_oid, 'EXECUTE')
  ),
  22::bigint,
  'service role can execute every newer public RPC wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from expected_new_authenticated_rpcs expected
    where has_function_privilege('anon', expected.function_oid, 'EXECUTE') = expected.anon_execute
  ),
  22::bigint,
  'anonymous grants match the locked five-function public read and view matrix'
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

select extensions.ok(
  to_regprocedure('private.apply_pending_response_peek_binding()') is not null
  and to_regprocedure('public.apply_pending_response_peek_binding()') is null,
  'the response binding trigger implementation exists only in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.oid = 'private.apply_pending_response_peek_binding()'::regprocedure::oid
      and pg_get_function_result(p.oid) = 'trigger'
      and p.prosecdef
      and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-trigger-boundary'
  ),
  1::bigint,
  'the private response binding hook remains a privileged trigger implementation'
);

select extensions.is(
  (
    select count(*)::bigint
    from (values ('anon'::name), ('authenticated'::name), ('service_role'::name)) roles(role_name)
    where has_function_privilege(
      roles.role_name,
      'private.apply_pending_response_peek_binding()'::regprocedure,
      'EXECUTE'
    )
  ),
  0::bigint,
  'the internal trigger implementation is closed to all client roles'
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
