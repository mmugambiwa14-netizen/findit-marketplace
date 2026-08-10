begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from (
      select 1
      where position(
        'v_target_type text'
        in (select p.prosrc from pg_proc p where p.oid = 'private.admin_review_report(uuid,public.report_status,text)'::regprocedure::oid)
      ) > 0
        and position(
          'r.target_type'
          in (select p.prosrc from pg_proc p where p.oid = 'private.admin_review_report(uuid,public.report_status,text)'::regprocedure::oid)
        ) > 0
      union all
      select 1
      where position(
        '#variable_conflict use_column'
        in (select p.prosrc from pg_proc p where p.oid = 'private.admin_tour_queue(text,text,integer,integer)'::regprocedure::oid)
      ) > 0
      union all
      select 1
      where position(
        'order by e.queue_score desc'
        in (select p.prosrc from pg_proc p where p.oid = 'private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure::oid)
      ) > 0
        and position(
          'order by p.queue_score desc'
          in (select p.prosrc from pg_proc p where p.oid = 'private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure::oid)
        ) > 0
        and position(
          'order by v.queue_score desc'
          in (select p.prosrc from pg_proc p where p.oid = 'private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)'::regprocedure::oid)
        ) > 0
    ) as ambiguity_repairs
  ),
  3::bigint,
  'all three previously ambiguous PL/pgSQL functions prevent column-variable ambiguity'
);

select extensions.is(
  (
    select count(*)::bigint
    from unnest(array[
      'private.bind_response_peek(uuid,uuid[])'::regprocedure,
      'private.apply_pending_response_peek_binding()'::regprocedure
    ]) as targets(function_oid)
    join pg_proc p on p.oid = targets.function_oid::oid
    where position('''system''' in p.prosrc) > 0
      and position('''info''' in p.prosrc) = 0
      and position('''peek_request_answered''' in p.prosrc) > 0
  ),
  2::bigint,
  'both Response Peek notification paths use the valid system alert type and accepted event'
);

select extensions.ok(
  position(
    '''peek_response_available'''
    in pg_get_functiondef('private.bind_response_peek(uuid,uuid[])'::regprocedure::oid)
  ) = 0,
  'the direct Response Peek binding path no longer emits the retired event name'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'alert_type'
      and enum_value.enumlabel = 'system'
  ),
  1::bigint,
  'system is a valid alert type'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'alert_type'
      and enum_value.enumlabel = 'info'
  ),
  0::bigint,
  'info is not treated as a valid alert type'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.oid = 'public.ensure_recommendation_event_partition(date)'::regprocedure::oid
      and n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and position('pg_temp.recommendation_events_partition_buffer' in p.prosrc) > 0
      and position('execute ''truncate table pg_temp.recommendation_events_partition_buffer''' in p.prosrc) > 0
  ),
  1::bigint,
  'partition creation remains service-only and accesses the temporary buffer through dynamic SQL'
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
    where wrapper.oid = 'public.prepare_own_account_deletion(text)'::regprocedure::oid
      and wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and not wrapper.prosecdef
      and implementation.prosecdef
      and obj_description(wrapper.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
      and position('to_regclass(''public.email_notification_preferences'')' in implementation.prosrc) > 0
      and position('execute ''delete from public.email_notification_preferences where user_id = $1''' in implementation.prosrc) > 0
  ),
  1::bigint,
  'account deletion keeps an invoker wrapper and conditionally removes optional email preferences'
);

select extensions.is(
  (
    select count(*)::bigint
    from (values
      ('anon'::name, false),
      ('authenticated'::name, true),
      ('service_role'::name, true)
    ) expected(role_name, can_execute)
    where has_function_privilege(
      expected.role_name,
      'public.prepare_own_account_deletion(text)'::regprocedure,
      'EXECUTE'
    ) = expected.can_execute
      and has_function_privilege(
        expected.role_name,
        'private.prepare_own_account_deletion(text)'::regprocedure,
        'EXECUTE'
      ) = expected.can_execute
  ),
  3::bigint,
  'account deletion wrapper and implementation preserve the locked client-role grant matrix'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_trigger trigger_row
    join pg_proc trigger_function on trigger_function.oid = trigger_row.tgfoid
    join pg_namespace function_schema on function_schema.oid = trigger_function.pronamespace
    join pg_class target_table on target_table.oid = trigger_row.tgrelid
    join pg_namespace table_schema on table_schema.oid = target_table.relnamespace
    where not trigger_row.tgisinternal
      and trigger_row.tgname = 'trg_apply_pending_response_peek_binding'
      and function_schema.nspname = 'private'
      and trigger_function.proname = 'apply_pending_response_peek_binding'
      and table_schema.nspname = 'public'
      and target_table.relname = 'listing_tours'
  ),
  1::bigint,
  'moving the Response Peek trigger implementation preserves its listing_tours dependency'
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
  'the internal Response Peek trigger remains closed to every client role after recompilation'
);

select * from extensions.finish();
rollback;
