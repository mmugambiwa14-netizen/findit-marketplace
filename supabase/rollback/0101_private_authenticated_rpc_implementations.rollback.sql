-- 0101_private_authenticated_rpc_implementations.rollback.sql
-- Restore the exact pre-0101 public SECURITY DEFINER catalog.

create temporary table findit_0101_rollback_snapshot on commit drop as
select
  wrapper.proname as function_name,
  oidvectortypes(wrapper.proargtypes) as identity_types,
  pg_get_function_identity_arguments(wrapper.oid) as identity_arguments,
  implementation.oid::regprocedure::text as private_regprocedure_text,
  pg_get_function_arguments(implementation.oid) as full_arguments,
  pg_get_function_result(implementation.oid) as result_type,
  language.lanname as language_name,
  implementation.provolatile,
  implementation.proretset,
  implementation.proisstrict,
  implementation.proparallel,
  implementation.procost,
  implementation.prorows,
  implementation.pronargdefaults,
  implementation.proconfig,
  coalesce(implementation.proacl::text, '') as acl,
  md5(replace(implementation.prosrc, E'\r\n', E'\n')) as body_md5
from pg_proc wrapper
join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
join pg_proc implementation
  on implementation.proname = wrapper.proname
 and pg_get_function_identity_arguments(implementation.oid) = pg_get_function_identity_arguments(wrapper.oid)
join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
join pg_language language on language.oid = implementation.prolang
where wrapper_schema.nspname = 'public'
  and implementation_schema.nspname = 'private'
  and obj_description(wrapper.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
order by wrapper.proname, pg_get_function_identity_arguments(wrapper.oid);

do $rollback$
declare
  row_count integer;
  distinct_name_count integer;
  catalog_fingerprint text;
  target record;
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
  from findit_0101_rollback_snapshot;

  if row_count <> 57
     or distinct_name_count <> 57
     or catalog_fingerprint <> 'ce6194659e01b758dc20948daf351bea' then
    raise exception
      '0101 rollback catalog drifted: count %, names %, fingerprint %',
      row_count,
      distinct_name_count,
      catalog_fingerprint;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
      and (p.prosecdef or p.prolang <> (select oid from pg_language where lanname = 'sql'))
  ) then
    raise exception '0101 rollback refused because a public wrapper drifted';
  end if;

  for target in
    select *
    from findit_0101_rollback_snapshot
    order by function_name, identity_arguments
  loop
    execute format(
      'drop function public.%I(%s)',
      target.function_name,
      target.identity_types
    );
    execute format(
      'alter function %s set schema public',
      target.private_regprocedure_text
    );
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and obj_description(p.oid, 'pg_proc') = 'findit:0101-authenticated-boundary'
  ) then
    raise exception '0101 rollback left a compatibility wrapper marker';
  end if;

  if exists (
    select 1
    from findit_0101_rollback_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception '0101 rollback left a target implementation in private';
  end if;

  select
    count(*)::integer,
    md5(string_agg(
      concat_ws('|',
        p.proname,
        pg_get_function_identity_arguments(p.oid),
        pg_get_function_arguments(p.oid),
        pg_get_function_result(p.oid),
        language.lanname,
        p.provolatile::text,
        p.proretset::text,
        p.prosecdef::text,
        p.pronargdefaults::text,
        pg_get_userbyid(p.proowner),
        coalesce(array_to_string(p.proconfig, ','), ''),
        coalesce(p.proacl::text, ''),
        md5(replace(p.prosrc, E'\r\n', E'\n'))
      ),
      E'\n' order by p.proname, pg_get_function_identity_arguments(p.oid)
    ))
  into row_count, catalog_fingerprint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language language on language.oid = p.prolang
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if row_count <> 57 or catalog_fingerprint <> 'ce6194659e01b758dc20948daf351bea' then
    raise exception
      '0101 rollback did not restore the exact public catalog: count %, fingerprint %',
      row_count,
      catalog_fingerprint;
  end if;
end;
$rollback$;
