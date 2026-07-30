-- 0091_private_public_tour_summaries_implementation.sql
--
-- Remove direct API exposure of the public Tour-summary SECURITY DEFINER
-- implementation without changing its RPC signature, limits or result shape.
-- The canonical implementation moves to private; public retains a locked
-- SECURITY INVOKER compatibility wrapper.

create temporary table findit_0091_expected_function (
  function_name text not null,
  identity_arguments text not null,
  result_type text not null,
  language_name text not null,
  volatility "char" not null,
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null,
  primary key (function_name, identity_arguments)
) on commit drop;

insert into findit_0091_expected_function values (
  'public_tour_summaries',
  'p_listing_ids uuid[], p_service_ids uuid[]',
  'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)',
  'plpgsql',
  's',
  '3e72ef0e86cc539ee9f87ba6173def30',
  array['search_path=public']::text[],
  '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0091_expected_function) <> 1 then
    raise exception '0091 expected exactly one public Tour-summary fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_record.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
      and function_schema.nspname = 'private'
  ) then
    raise exception '0091 refused because a private Tour-summary implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('public_tour_summaries(' in coalesce(policy.qual, '')) > 0
       or position('public_tour_summaries(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0091 refused because the public Tour-summary function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('public_tour_summaries(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(caller.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
    );

  if caller_count <> 0 then
    raise exception '0091 refused because % stored Tour-summary callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0091_expected_function expected
  left join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = expected.identity_arguments
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> expected.language_name
     or pg_get_function_result(function_record.oid) <> expected.result_type
     or function_record.provolatile <> expected.volatility
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0091 refused because the public Tour-summary fingerprint drifted';
  end if;

  alter function public.public_tour_summaries(uuid[], uuid[]) set schema private;
  alter function private.public_tour_summaries(uuid[], uuid[]) set search_path = '';

  revoke all on function private.public_tour_summaries(uuid[], uuid[])
    from public, anon, authenticated, service_role;
  grant execute on function private.public_tour_summaries(uuid[], uuid[])
    to anon, authenticated, service_role;

  create function public.public_tour_summaries(
    p_listing_ids uuid[],
    p_service_ids uuid[]
  )
  returns table (
    tour_id uuid,
    parent_type text,
    parent_id uuid,
    duration_seconds numeric,
    published_at timestamptz
  )
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select *
    from private.public_tour_summaries(p_listing_ids, p_service_ids);
  $$;

  revoke all on function public.public_tour_summaries(uuid[], uuid[])
    from public, anon, authenticated, service_role;
  grant execute on function public.public_tour_summaries(uuid[], uuid[])
    to anon, authenticated, service_role;

  select count(*)::integer into private_count
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
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '3e72ef0e86cc539ee9f87ba6173def30';

  if private_count <> 1 then
    raise exception '0091 did not create the locked private Tour-summary implementation';
  end if;

  select count(*)::integer into public_count
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
    and position('private.public_tour_summaries(p_listing_ids, p_service_ids)' in function_record.prosrc) > 0;

  if public_count <> 1 then
    raise exception '0091 did not create the locked public Tour-summary wrapper';
  end if;

  if exists (
    select 1
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
  ) then
    raise exception '0091 left a PUBLIC execute grant on a Tour-summary function';
  end if;

  if not (
    has_function_privilege('anon', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
    and has_function_privilege('service_role', 'public.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
    and has_function_privilege('anon', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
    and has_function_privilege('service_role', 'private.public_tour_summaries(uuid[],uuid[])', 'EXECUTE')
  ) then
    raise exception '0091 did not preserve required Tour-summary execution grants';
  end if;
end
$migration$;
