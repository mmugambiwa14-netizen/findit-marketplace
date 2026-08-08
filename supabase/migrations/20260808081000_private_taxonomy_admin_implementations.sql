-- 20260808081000_private_taxonomy_admin_implementations.sql
--
-- The repository security model requires every authenticated-callable
-- SECURITY DEFINER implementation to live in the non-exposed private schema.
-- Preserve the six taxonomy admin RPC signatures through SECURITY INVOKER SQL
-- wrappers while moving their privileged implementations behind that boundary.

begin;

create temporary table findit_taxonomy_admin_snapshot on commit drop as
select
  p.oid,
  p.proname as function_name,
  p.oid::regprocedure::text as regprocedure_text,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
  p.provolatile,
  p.proretset,
  p.proisstrict,
  p.proparallel,
  p.procost,
  p.prorows,
  p.pronargs,
  p.pronargdefaults,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and p.proname in (
    'admin_taxonomy_rows',
    'admin_add_taxonomy_node',
    'admin_update_taxonomy_node',
    'admin_taxonomy_rows_v2',
    'admin_add_taxonomy_node_v2',
    'admin_update_taxonomy_node_v2'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

do $migration$
declare
  target record;
  row_count integer;
  call_arguments text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_body text;
  wrapper_sql text;
begin
  select count(*)::integer into row_count from findit_taxonomy_admin_snapshot;
  if row_count <> 6 then
    raise exception 'expected six public taxonomy admin implementations, found %', row_count;
  end if;

  if exists (
    select 1
    from findit_taxonomy_admin_snapshot
    where not authenticated_execute or anon_execute
  ) then
    raise exception 'taxonomy admin implementation privilege snapshot is unexpected';
  end if;

  if exists (
    select 1
    from findit_taxonomy_admin_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception 'taxonomy admin private implementation already exists';
  end if;

  for target in
    select * from findit_taxonomy_admin_snapshot
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
    strict_clause := case when target.proisstrict then 'strict' else 'called on null input' end;
    parallel_clause := case target.proparallel
      when 's' then 'parallel safe'
      when 'r' then 'parallel restricted'
      else 'parallel unsafe'
    end;
    rows_clause := case when target.proretset then format('rows %s', target.prorows) else '' end;
    wrapper_body := case
      when target.proretset then format('select * from private.%I(%s);', target.function_name, call_arguments)
      else format('select private.%I(%s);', target.function_name, call_arguments)
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
      'findit:taxonomy-authenticated-boundary'
    );
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'admin_taxonomy_rows',
        'admin_add_taxonomy_node',
        'admin_update_taxonomy_node',
        'admin_taxonomy_rows_v2',
        'admin_add_taxonomy_node_v2',
        'admin_update_taxonomy_node_v2'
      )
  ) then
    raise exception 'a taxonomy admin SECURITY DEFINER implementation remains public';
  end if;

  if (
    select count(*)
    from pg_proc wrapper
    join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
    join pg_proc implementation
      on implementation.proname = wrapper.proname
     and pg_get_function_identity_arguments(implementation.oid) = pg_get_function_identity_arguments(wrapper.oid)
    join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
    where wrapper_schema.nspname = 'public'
      and implementation_schema.nspname = 'private'
      and wrapper.proname in (
        'admin_taxonomy_rows',
        'admin_add_taxonomy_node',
        'admin_update_taxonomy_node',
        'admin_taxonomy_rows_v2',
        'admin_add_taxonomy_node_v2',
        'admin_update_taxonomy_node_v2'
      )
      and not wrapper.prosecdef
      and implementation.prosecdef
      and wrapper.proconfig = array['search_path=""']::text[]
  ) <> 6 then
    raise exception 'taxonomy admin private/public boundary did not converge';
  end if;
end;
$migration$;

commit;
