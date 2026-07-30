-- Roll back migration 0097 by removing the public invoker wrapper and moving
-- the canonical stable search implementation back to public with its original
-- fourteen defaults, result projection, search path and role grants.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'public_listing_search_page'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.pronargdefaults = 14
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.public_listing_search_page(' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0097 rollback expected one public listing search wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'public_listing_search_page'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.pronargdefaults = 14
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '2fa173e978e3d5142ef72c6266e9dc20';

  if private_implementation_count <> 1 then
    raise exception '0097 rollback expected one private listing search implementation, found %', private_implementation_count;
  end if;

  drop function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  );

  alter function private.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) set search_path = public;

  alter function private.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) set schema public;

  revoke all on function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) from public, anon, authenticated, service_role;

  grant execute on function public.public_listing_search_page(
    text, text, text, text, numeric, numeric, integer, text, text, text,
    text, text, text, uuid, integer
  ) to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'public_listing_search_page'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_kind text, p_query text, p_category text, p_location_id text, p_min_price numeric, p_max_price numeric, p_min_bedrooms integer, p_brand text, p_condition text, p_fuel_type text, p_transmission text, p_sort text, p_cursor_value text, p_cursor_id uuid, p_limit integer'
    and md5(pg_get_function_result(function_record.oid)) = 'fa68a2b80d7a4dd1844ef87566d01e12'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.pronargdefaults = 14
    and function_record.proconfig = array['search_path=public']::text[]
    and coalesce(function_record.proacl::text, '') =
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '2fa173e978e3d5142ef72c6266e9dc20';

  if restored_count <> 1 then
    raise exception '0097 rollback did not restore the canonical public listing search implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'public_listing_search_page'
  ) then
    raise exception '0097 rollback left the public listing search implementation in private';
  end if;
end
$rollback$;

commit;
