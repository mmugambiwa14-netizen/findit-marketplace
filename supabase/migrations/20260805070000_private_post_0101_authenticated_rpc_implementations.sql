-- Move authenticated-callable SECURITY DEFINER RPCs added after migration 0101
-- into the non-exposed private schema. Preserve the public API through
-- SECURITY INVOKER SQL wrappers and preserve the effective browser/server role
-- grant matrix. The six legacy offset admin RPCs retired by 20260805033000 stay
-- closed because they are no longer authenticated-callable and are therefore
-- deliberately outside this snapshot.

create temporary table findit_202608050700_snapshot on commit drop as
select
  p.oid,
  p.proname as function_name,
  p.oid::regprocedure::text as regprocedure_text,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
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
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  obj_description(p.oid, 'pg_proc') as original_comment,
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
  target_names text;
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
begin
  select count(*)::integer,
         string_agg(regprocedure_text, ', ' order by function_name, identity_arguments)
    into target_count, target_names
  from findit_202608050700_snapshot;

  if target_count <> 22 then
    raise exception
      '202608050700 authenticated RPC catalog drifted: expected 22, found % (%)',
      target_count,
      coalesce(target_names, 'none');
  end if;

  if exists (
    select 1
    from findit_202608050700_snapshot
    where language_name not in ('sql', 'plpgsql')
       or not authenticated_execute
       or self_reference
  ) then
    raise exception '202608050700 encountered an unsupported or self-referential RPC';
  end if;

  if exists (
    select 1
    from findit_202608050700_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception '202608050700 refused because a target private implementation already exists';
  end if;

  for target in
    select *
    from findit_202608050700_snapshot
    order by function_name, identity_arguments
  loop
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

    execute format('alter function %s set schema private', target.regprocedure_text);

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
    end if;
    if target.authenticated_execute then
      execute format(
        'grant execute on function public.%I(%s) to authenticated',
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
    end if;

    execute format(
      'comment on function public.%I(%s) is %L',
      target.function_name,
      target.identity_types,
      'findit:202608050700-authenticated-boundary'
    );
  end loop;

  select count(*)::integer
    into private_count
  from findit_202608050700_snapshot expected
  join pg_proc implementation
    on implementation.proname = expected.function_name
   and pg_get_function_identity_arguments(implementation.oid) = expected.identity_arguments
  join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
  where implementation_schema.nspname = 'private'
    and implementation.prosecdef
    and pg_get_function_result(implementation.oid) = expected.result_type
    and implementation.provolatile = expected.provolatile
    and implementation.proretset = expected.proretset
    and implementation.proisstrict = expected.proisstrict
    and implementation.proparallel = expected.proparallel
    and implementation.procost = expected.procost
    and implementation.prorows = expected.prorows
    and implementation.pronargdefaults = expected.pronargdefaults;

  select count(*)::integer
    into wrapper_count
  from findit_202608050700_snapshot expected
  join pg_proc wrapper
    on wrapper.proname = expected.function_name
   and pg_get_function_identity_arguments(wrapper.oid) = expected.identity_arguments
  join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
  join pg_language wrapper_language on wrapper_language.oid = wrapper.prolang
  where wrapper_schema.nspname = 'public'
    and wrapper_language.lanname = 'sql'
    and not wrapper.prosecdef
    and wrapper.proconfig = array['search_path=""']::text[]
    and pg_get_function_result(wrapper.oid) = expected.result_type
    and wrapper.provolatile = expected.provolatile
    and wrapper.proretset = expected.proretset
    and wrapper.proisstrict = expected.proisstrict
    and wrapper.proparallel = expected.proparallel
    and wrapper.procost = expected.procost
    and wrapper.prorows = expected.prorows
    and wrapper.pronargdefaults = expected.pronargdefaults
    and obj_description(wrapper.oid, 'pg_proc') = 'findit:202608050700-authenticated-boundary'
    and position('private.' || expected.function_name || '(' in wrapper.prosrc) > 0;

  if private_count <> 22 or wrapper_count <> 22 then
    raise exception
      '202608050700 did not preserve all implementations and wrappers: private %, public %',
      private_count,
      wrapper_count;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception '202608050700 left an authenticated public SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from findit_202608050700_snapshot expected
    join pg_proc wrapper
      on wrapper.proname = expected.function_name
     and pg_get_function_identity_arguments(wrapper.oid) = expected.identity_arguments
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_proc implementation
      on implementation.proname = expected.function_name
     and pg_get_function_identity_arguments(implementation.oid) = expected.identity_arguments
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and (
        has_function_privilege('anon', wrapper.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('authenticated', wrapper.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('service_role', wrapper.oid, 'EXECUTE') <> expected.service_execute
        or has_function_privilege('anon', implementation.oid, 'EXECUTE') <> expected.anon_execute
        or has_function_privilege('authenticated', implementation.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('service_role', implementation.oid, 'EXECUTE') <> expected.service_execute
      )
  ) then
    raise exception '202608050700 did not preserve the execution-grant matrix';
  end if;
end;
$migration$;
