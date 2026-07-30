-- Roll back migration 0090 by removing the public invoker wrapper and moving
-- the original seller-profile SECURITY DEFINER implementation back to public
-- with its previous search path and execution grants.

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
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.get_public_seller_profile(seller_email)' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0090 rollback expected one public seller-profile wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '082229bceba5a21b0ea13b80a41c7a7c';

  if private_implementation_count <> 1 then
    raise exception '0090 rollback expected one private seller-profile implementation, found %', private_implementation_count;
  end if;

  drop function public.get_public_seller_profile(text);

  alter function private.get_public_seller_profile(text) set search_path = public;
  alter function private.get_public_seller_profile(text) set schema public;

  revoke all on function public.get_public_seller_profile(text) from public, anon, authenticated, service_role;
  grant execute on function public.get_public_seller_profile(text) to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'get_public_seller_profile'
    and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=public']::text[]
    and coalesce(function_record.proacl::text, '') = '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '082229bceba5a21b0ea13b80a41c7a7c';

  if restored_count <> 1 then
    raise exception '0090 rollback did not restore the canonical public seller-profile implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
  ) then
    raise exception '0090 rollback left the seller-profile implementation in private';
  end if;
end
$rollback$;

commit;
