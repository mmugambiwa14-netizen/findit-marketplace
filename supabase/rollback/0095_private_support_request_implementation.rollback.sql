-- Roll back migration 0095 by removing the public SECURITY INVOKER wrapper
-- and moving the canonical support request SECURITY DEFINER implementation back
-- to public with its original search path, default argument and execution grants.

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
    and function_record.proname = 'submit_support_request'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.pronargdefaults = 1
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.submit_support_request(' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0095 rollback expected one public support request wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'submit_support_request'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.pronargdefaults = 1
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '50b7df2c3d206e62dec244acf5f682d1';

  if private_implementation_count <> 1 then
    raise exception '0095 rollback expected one private support request implementation, found %', private_implementation_count;
  end if;

  drop function public.submit_support_request(text, text, text, text);

  alter function private.submit_support_request(text, text, text, text) set search_path = public;
  alter function private.submit_support_request(text, text, text, text) set schema public;

  revoke all on function public.submit_support_request(text, text, text, text)
    from public, anon, authenticated, service_role;
  grant execute on function public.submit_support_request(text, text, text, text)
    to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'submit_support_request'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_category text, p_contact_email text, p_message text, p_related_reference text'
    and pg_get_function_result(function_record.oid) = 'jsonb'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.pronargdefaults = 1
    and function_record.proconfig = array['search_path=public']::text[]
    and coalesce(function_record.proacl::text, '') =
      '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '50b7df2c3d206e62dec244acf5f682d1';

  if restored_count <> 1 then
    raise exception '0095 rollback did not restore the canonical public support request implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'submit_support_request'
  ) then
    raise exception '0095 rollback left the support request implementation in private';
  end if;
end
$rollback$;

commit;
