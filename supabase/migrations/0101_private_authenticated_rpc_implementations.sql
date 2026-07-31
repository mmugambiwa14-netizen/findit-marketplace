-- 0101_private_authenticated_rpc_implementations.sql
--
-- Move every remaining authenticated-callable public SECURITY DEFINER RPC
-- implementation into the non-exposed private schema. Preserve the complete
-- public API surface through SECURITY INVOKER SQL wrappers, including names,
-- input defaults, result shapes, volatility, strictness, parallel category,
-- cost/rows and role grants.
--
-- This is intentionally one catalog-fingerprinted boundary. Splitting the same
-- structural operation into dozens of independent migrations would leave mixed
-- exposure states and create significantly more rollback and drift risk.

create temporary table findit_0101_snapshot on commit drop as
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
  coalesce(p.proacl::text, '') as acl,
  md5(replace(p.prosrc, E'\r\n', E'\n')) as body_md5,
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
  row_count integer;
  distinct_name_count integer;
  catalog_fingerprint text;
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
  select
    count(*)::integer,
    count(distinct function_name)::integer,
    md5(string_agg(
      concat_ws('|',
        function_name,
        identity_arguments,
        full_arguments,
        result_type,
        language_name,
        provolatile::text,
        proretset::text,
        'true',
        pronargdefaults::text,
        'postgres',
        coalesce(array_to_string(proconfig, ','), ''),
        acl,
        body_md5
      ),
      E'\n' order by function_name, identity_arguments
    ))
  into row_count, distinct_name_count, catalog_fingerprint
  from findit_0101_snapshot;

  if row_count <> 57
     or distinct_name_count <> 57
     or catalog_fingerprint <> 'ce6194659e01b758dc20948daf351bea' then
    raise exception
      '0101 authenticated function catalog drifted: count %, names %, fingerprint %',
      row_count,
      distinct_name_count,
      catalog_fingerprint;
  end if;

  if exists (
    select 1
    from findit_0101_snapshot
    where language_name not in ('sql', 'plpgsql')
       or not authenticated_execute
       or anon_execute
       or function_name is null
       or self_reference
  ) then
    raise exception '0101 encountered an unsupported, anonymously exposed or self-referential target';
  end if;

  if exists (
    select 1
    from findit_0101_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception '0101 refused because a target private implementation already exists';
  end if;

  for target in
    select *
    from findit_0101_snapshot
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
      'findit:0101-authenticated-boundary'
    );
  end loop;

  select count(*)::integer
  into private_count
  from findit_0101_snapshot expected
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
    and coalesce(p.proacl::text, '') = expected.acl
    and p.prosecdef
    and md5(replace(p.prosrc, E'\r\n', E'\n')) = expected.body_md5;

  select count(*)::integer
  into wrapper_count
  from findit_0101_snapshot expected
  join pg_proc p
    on p.proname = expected.function_name
   and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
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
    and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
    and position('private.' || expected.function_name || '(' in p.prosrc) > 0;

  if private_count <> 57 or wrapper_count <> 57 then
    raise exception
      '0101 did not preserve all implementations and wrappers: private %, public %',
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
    raise exception '0101 left an authenticated public SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from findit_0101_snapshot expected
    join pg_proc public_wrapper
      on public_wrapper.proname = expected.function_name
     and pg_get_function_identity_arguments(public_wrapper.oid) = expected.identity_arguments
    join pg_namespace public_schema on public_schema.oid = public_wrapper.pronamespace
    join pg_proc private_implementation
      on private_implementation.proname = expected.function_name
     and pg_get_function_identity_arguments(private_implementation.oid) = expected.identity_arguments
    join pg_namespace private_schema on private_schema.oid = private_implementation.pronamespace
    where public_schema.nspname = 'public'
      and private_schema.nspname = 'private'
      and (
        has_function_privilege('anon', public_wrapper.oid, 'EXECUTE')
        or has_function_privilege('anon', private_implementation.oid, 'EXECUTE')
        or has_function_privilege('authenticated', public_wrapper.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('authenticated', private_implementation.oid, 'EXECUTE') <> expected.authenticated_execute
        or has_function_privilege('service_role', public_wrapper.oid, 'EXECUTE') <> expected.service_execute
        or has_function_privilege('service_role', private_implementation.oid, 'EXECUTE') <> expected.service_execute
      )
  ) then
    raise exception '0101 did not preserve the target execution-grant matrix';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0101 left PUBLIC execute on a compatibility wrapper';
  end if;
end;
$migration$;
