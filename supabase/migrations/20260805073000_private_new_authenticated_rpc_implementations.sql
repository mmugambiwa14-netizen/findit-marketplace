begin;

-- Extend the authenticated RPC implementation boundary established by 0101.
-- Later feature migrations added 22 authenticated-callable SECURITY DEFINER
-- functions in public. Ordinary RPC implementations move behind invoker
-- wrappers with signatures, defaults, results, planner attributes and named-role
-- grants preserved. Trigger functions move to private with all client execution
-- revoked because they are internal database hooks, not RPC endpoints.

create temporary table findit_20260805073000_snapshot on commit drop as
select
  p.oid,
  p.proname as function_name,
  p.oid::regprocedure::text as regprocedure_text,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
  pg_get_function_result(p.oid) in ('trigger', 'event_trigger') as is_trigger,
  l.lanname as language_name,
  p.provolatile,
  p.proretset,
  p.proisstrict,
  p.proparallel,
  p.procost,
  p.prorows,
  p.pronargs,
  p.pronargdefaults,
  p.proconfig,
  md5(replace(p.prosrc, E'\r\n', E'\n')) as body_md5,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  position(p.proname || '(' in p.prosrc) > 0 as self_reference
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by p.proname, pg_get_function_identity_arguments(p.oid);

do $migration$
declare
  target_count integer;
  rpc_target_count integer;
  trigger_target_count integer;
  target record;
  call_arguments text;
  wrapper_body text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_sql text;
  private_count integer;
  wrapper_count integer;
  private_trigger_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (where not is_trigger)::integer,
    count(*) filter (where is_trigger)::integer
  into target_count, rpc_target_count, trigger_target_count
  from findit_20260805073000_snapshot;

  if target_count <> 22 then
    raise exception
      '20260805073000 authenticated function catalog drifted: expected 22, found %',
      target_count;
  end if;

  if exists (
    select 1
    from findit_20260805073000_snapshot
    where language_name not in ('sql', 'plpgsql')
       or not authenticated_execute
       or function_name is null
       or (self_reference and not is_trigger)
  ) then
    raise exception
      '20260805073000 encountered an unsupported or self-referential RPC target';
  end if;

  if exists (
    select 1
    from findit_20260805073000_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception
      '20260805073000 refused because a target private implementation already exists';
  end if;

  for target in
    select *
    from findit_20260805073000_snapshot
    order by function_name, identity_arguments
  loop
    execute format('alter function %s set schema private', target.regprocedure_text);
    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );

    if target.is_trigger then
      execute format(
        'comment on function private.%I(%s) is %L',
        target.function_name,
        target.identity_types,
        'findit:20260805073000-trigger-boundary'
      );
      continue;
    end if;

    select coalesce(string_agg('$' || position::text, ', ' order by position), '')
    into call_arguments
    from generate_series(1, target.pronargs) as generated(position);

    volatility_clause := case target.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;
    strict_clause := case
      when target.proisstrict then 'strict'
      else 'called on null input'
    end;
    parallel_clause := case target.proparallel
      when 's' then 'parallel safe'
      when 'r' then 'parallel restricted'
      else 'parallel unsafe'
    end;
    rows_clause := case
      when target.proretset then format('rows %s', target.prorows)
      else ''
    end;
    wrapper_body := case
      when target.proretset then
        format('select * from private.%I(%s);', target.function_name, call_arguments)
      else
        format('select private.%I(%s);', target.function_name, call_arguments)
    end;

    wrapper_sql := format(
      'create function public.%I(%s) returns %s language sql %s %s security invoker %s cost %s %s set search_path = '''' as $wrapper$%s$wrapper$',
      target.function_name,
      target.full_arguments,
      target.result_type,
      volatility_clause,
      strict_clause,
      parallel_clause,
      target.procost,
      rows_clause,
      wrapper_body
    );
    execute wrapper_sql;

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );

    if target.anon_execute then
      execute format(
        'grant execute on function public.%I(%s) to anon',
        target.function_name,
        target.identity_types
      );
      execute format(
        'grant execute on function private.%I(%s) to anon',
        target.function_name,
        target.identity_types
      );
    end if;

    if target.authenticated_execute then
      execute format(
        'grant execute on function public.%I(%s) to authenticated',
        target.function_name,
        target.identity_types
      );
      execute format(
        'grant execute on function private.%I(%s) to authenticated',
        target.function_name,
        target.identity_types
      );
    end if;

    if target.service_execute then
      execute format(
        'grant execute on function public.%I(%s) to service_role',
        target.function_name,
        target.identity_types
      );
      execute format(
        'grant execute on function private.%I(%s) to service_role',
        target.function_name,
        target.identity_types
      );
    end if;

    execute format(
      'comment on function public.%I(%s) is %L',
      target.function_name,
      target.identity_types,
      'findit:20260805073000-authenticated-boundary'
    );
  end loop;

  select count(*)::integer
  into private_count
  from findit_20260805073000_snapshot expected
  join pg_proc p
    on p.proname = expected.function_name
   and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'private'
    and l.lanname = expected.language_name
    and pg_get_function_result(p.oid) = expected.result_type
    and p.provolatile = expected.provolatile
    and p.proretset = expected.proretset
    and p.proisstrict = expected.proisstrict
    and p.proparallel = expected.proparallel
    and p.procost = expected.procost
    and p.prorows = expected.prorows
    and p.pronargdefaults = expected.pronargdefaults
    and p.proconfig is not distinct from expected.proconfig
    and p.prosecdef
    and md5(replace(p.prosrc, E'\r\n', E'\n')) = expected.body_md5;

  select count(*)::integer
  into wrapper_count
  from findit_20260805073000_snapshot expected
  join pg_proc p
    on p.proname = expected.function_name
   and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where not expected.is_trigger
    and n.nspname = 'public'
    and l.lanname = 'sql'
    and pg_get_function_result(p.oid) = expected.result_type
    and p.provolatile = expected.provolatile
    and p.proretset = expected.proretset
    and p.proisstrict = expected.proisstrict
    and p.proparallel = expected.proparallel
    and p.procost = expected.procost
    and p.prorows = expected.prorows
    and p.pronargdefaults = expected.pronargdefaults
    and p.proconfig = array['search_path=""']::text[]
    and not p.prosecdef
    and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-authenticated-boundary'
    and position('private.' || expected.function_name || '(' in p.prosrc) > 0;

  select count(*)::integer
  into private_trigger_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-trigger-boundary'
    and pg_get_function_result(p.oid) in ('trigger', 'event_trigger');

  if private_count <> target_count
     or wrapper_count <> rpc_target_count
     or private_trigger_count <> trigger_target_count then
    raise exception
      '20260805073000 boundary mismatch: private %, wrappers %/%, triggers %/%',
      private_count,
      wrapper_count,
      rpc_target_count,
      private_trigger_count,
      trigger_target_count;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception
      '20260805073000 left an authenticated public SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from findit_20260805073000_snapshot expected
    join pg_proc public_wrapper
      on public_wrapper.proname = expected.function_name
     and pg_get_function_identity_arguments(public_wrapper.oid) = expected.identity_arguments
    join pg_namespace public_schema on public_schema.oid = public_wrapper.pronamespace
    join pg_proc private_implementation
      on private_implementation.proname = expected.function_name
     and pg_get_function_identity_arguments(private_implementation.oid) = expected.identity_arguments
    join pg_namespace private_schema on private_schema.oid = private_implementation.pronamespace
    where not expected.is_trigger
      and public_schema.nspname = 'public'
      and private_schema.nspname = 'private'
      and (
        has_function_privilege('anon', public_wrapper.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('anon', private_implementation.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('authenticated', public_wrapper.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('authenticated', private_implementation.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('service_role', public_wrapper.oid, 'EXECUTE') <> expected.service_execute
        or has_function_privilege('service_role', private_implementation.oid, 'EXECUTE') <> expected.service_execute
      )
  ) then
    raise exception
      '20260805073000 did not preserve the RPC named-role execution matrix';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and obj_description(p.oid, 'pg_proc') = 'findit:20260805073000-trigger-boundary'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ) then
    raise exception
      '20260805073000 left a client role grant on an internal trigger function';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname in ('public', 'private')
      and (
        obj_description(p.oid, 'pg_proc') in (
          'findit:20260805073000-authenticated-boundary',
          'findit:20260805073000-trigger-boundary'
        )
        or exists (
          select 1
          from findit_20260805073000_snapshot expected
          where n.nspname = 'private'
            and p.proname = expected.function_name
            and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
        )
      )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception
      '20260805073000 left PUBLIC execute on a wrapper or implementation';
  end if;
end;
$migration$;

commit;
