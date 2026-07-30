-- 0089_private_country_helper_implementations.sql
--
-- Remove direct API exposure of the three country capability SECURITY DEFINER
-- helpers without changing their public signatures or stored caller semantics.
-- Original implementations move to private; public SECURITY INVOKER wrappers
-- preserve compatibility for browser RPCs and existing stored functions.

create temporary table findit_0089_expected_functions (
  function_name text not null,
  identity_arguments text not null,
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null,
  primary key (function_name, identity_arguments)
) on commit drop;

insert into findit_0089_expected_functions values
  (
    'is_country_browsable',
    'p_country_code text',
    'c1ac4e343111eb3da49b465a2488a0c1',
    array['search_path=public']::text[],
    '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  ),
  (
    'is_country_publishable',
    'p_country_code text',
    'de306cd698ba706e93046b1186c55fcd',
    array['search_path=public']::text[],
    '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  ),
  (
    'is_supported_listing_currency',
    'p_country_code text, p_currency text',
    '84f3038efb0ddac01eb0171a3ab2d824',
    array['search_path=public']::text[],
    '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
  );

create temporary table findit_0089_expected_callers (
  helper_name text not null,
  caller_schema text not null,
  caller_name text not null,
  caller_arguments text not null,
  primary key (helper_name, caller_schema, caller_name, caller_arguments)
) on commit drop;

insert into findit_0089_expected_callers
select
  'is_country_browsable',
  caller_schema.nspname,
  caller.proname,
  pg_get_function_identity_arguments(caller.oid)
from pg_proc caller
join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
where position('public.is_country_browsable(' in caller.prosrc) > 0;

insert into findit_0089_expected_callers
select
  'is_country_publishable',
  caller_schema.nspname,
  caller.proname,
  pg_get_function_identity_arguments(caller.oid)
from pg_proc caller
join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
where position('public.is_country_publishable(' in caller.prosrc) > 0;

insert into findit_0089_expected_callers
select
  'is_supported_listing_currency',
  caller_schema.nspname,
  caller.proname,
  pg_get_function_identity_arguments(caller.oid)
from pg_proc caller
join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
where position('public.is_supported_listing_currency(' in caller.prosrc) > 0;

do $migration$
declare
  mismatch_count integer;
  public_count integer;
  private_count integer;
  caller_count integer;
begin
  if (select count(*) from findit_0089_expected_functions) <> 3 then
    raise exception '0089 expected exactly three country helper fingerprints';
  end if;

  if (select count(*) from findit_0089_expected_callers where helper_name = 'is_country_browsable') <> 1 then
    raise exception '0089 expected exactly one country browsing caller';
  end if;

  if (select count(*) from findit_0089_expected_callers where helper_name = 'is_country_publishable') <> 2 then
    raise exception '0089 expected exactly two country publishing callers';
  end if;

  if (select count(*) from findit_0089_expected_callers where helper_name = 'is_supported_listing_currency') <> 1 then
    raise exception '0089 expected exactly one listing currency caller';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
  ) then
    raise exception '0089 refused because a private country helper already exists';
  end if;

  select count(*)::integer into mismatch_count
  from findit_0089_expected_functions expected
  left join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = expected.identity_arguments
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'sql'
     or pg_get_function_result(function_record.oid) <> 'boolean'
     or function_record.provolatile <> 's'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0089 refused because % country helper fingerprints drifted', mismatch_count;
  end if;

  alter function public.is_country_browsable(text) set schema private;
  alter function public.is_country_publishable(text) set schema private;
  alter function public.is_supported_listing_currency(text, text) set schema private;

  alter function private.is_country_browsable(text) set search_path = '';
  alter function private.is_country_publishable(text) set search_path = '';
  alter function private.is_supported_listing_currency(text, text) set search_path = '';

  revoke all on function private.is_country_browsable(text) from public, anon, authenticated, service_role;
  grant execute on function private.is_country_browsable(text) to anon, authenticated, service_role;

  revoke all on function private.is_country_publishable(text) from public, anon, authenticated, service_role;
  grant execute on function private.is_country_publishable(text) to anon, authenticated, service_role;

  revoke all on function private.is_supported_listing_currency(text, text) from public, anon, authenticated, service_role;
  grant execute on function private.is_supported_listing_currency(text, text) to anon, authenticated, service_role;

  create function public.is_country_browsable(p_country_code text)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_country_browsable(p_country_code);
  $$;

  create function public.is_country_publishable(p_country_code text)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_country_publishable(p_country_code);
  $$;

  create function public.is_supported_listing_currency(
    p_country_code text,
    p_currency text
  )
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
  as $$
    select private.is_supported_listing_currency(p_country_code, p_currency);
  $$;

  revoke all on function public.is_country_browsable(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_country_browsable(text) to anon, authenticated, service_role;

  revoke all on function public.is_country_publishable(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_country_publishable(text) to anon, authenticated, service_role;

  revoke all on function public.is_supported_listing_currency(text, text) from public, anon, authenticated, service_role;
  grant execute on function public.is_supported_listing_currency(text, text) to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname in (
      'is_country_browsable',
      'is_country_publishable',
      'is_supported_listing_currency'
    )
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[];

  if private_count <> 3 then
    raise exception '0089 created only % of three locked private country implementations', private_count;
  end if;

  select count(*)::integer into public_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname in (
      'is_country_browsable',
      'is_country_publishable',
      'is_supported_listing_currency'
    )
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.' || function_record.proname || '(' in function_record.prosrc) > 0;

  if public_count <> 3 then
    raise exception '0089 created only % of three public country wrappers', public_count;
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
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0089 left a PUBLIC execute grant on a country helper';
  end if;

  select count(*)::integer into caller_count
  from findit_0089_expected_callers expected
  join pg_proc caller
    on caller.proname = expected.caller_name
   and pg_get_function_identity_arguments(caller.oid) = expected.caller_arguments
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
   and caller_schema.nspname = expected.caller_schema
  where position('public.' || expected.helper_name || '(' in caller.prosrc) > 0;

  if caller_count <> 4 then
    raise exception '0089 preserved only % of four public country helper call paths', caller_count;
  end if;
end
$migration$;
