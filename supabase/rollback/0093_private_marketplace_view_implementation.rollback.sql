-- Roll back migration 0093 by removing the public SECURITY INVOKER wrapper
-- and moving the canonical marketplace view SECURITY DEFINER implementation
-- back to public with the original execution grants. Keep the hardened empty
-- search_path: restoring search_path=public would reintroduce the exact
-- SECURITY DEFINER search-path vulnerability that 0093 removed.

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
    and function_record.proname = 'record_marketplace_view'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
    and pg_get_function_result(function_record.oid) = 'bigint'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.record_marketplace_view(p_parent_type, p_parent_id)' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0093 rollback expected one public marketplace view wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'record_marketplace_view'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
    and pg_get_function_result(function_record.oid) = 'bigint'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '16ed1360668ed6295a3d8ed0e219f55c';

  if private_implementation_count <> 1 then
    raise exception '0093 rollback expected one private marketplace view implementation, found %', private_implementation_count;
  end if;

  drop function public.record_marketplace_view(text, uuid);

  alter function private.record_marketplace_view(text, uuid) set search_path = '';
  alter function private.record_marketplace_view(text, uuid) set schema public;

  revoke all on function public.record_marketplace_view(text, uuid)
    from public, anon, authenticated, service_role;
  grant execute on function public.record_marketplace_view(text, uuid)
    to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'record_marketplace_view'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
    and pg_get_function_result(function_record.oid) = 'bigint'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and coalesce(function_record.proacl::text, '') = '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '16ed1360668ed6295a3d8ed0e219f55c';

  if restored_count <> 1 then
    raise exception '0093 rollback did not restore the canonical public marketplace view implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'record_marketplace_view'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_parent_type text, p_parent_id uuid'
  ) then
    raise exception '0093 rollback left the marketplace view implementation in private';
  end if;
end
$rollback$;

commit;
