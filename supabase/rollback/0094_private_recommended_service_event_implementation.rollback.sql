-- Roll back migration 0094 by removing the public SECURITY INVOKER wrapper
-- and moving the canonical related-service event SECURITY DEFINER implementation
-- back to public with its original search path and execution grants.

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
    and function_record.proname = 'record_recommended_service_event_v1'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(function_record.oid) = 'uuid'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.record_recommended_service_event_v1(' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0094 rollback expected one public recommended-service event wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'record_recommended_service_event_v1'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(function_record.oid) = 'uuid'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '1e2fa95e2bcb13cf6cf563669855e840';

  if private_implementation_count <> 1 then
    raise exception '0094 rollback expected one private recommended-service event implementation, found %', private_implementation_count;
  end if;

  drop function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  );

  alter function private.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) set search_path = public;
  alter function private.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) set schema public;

  revoke all on function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) from public, anon, authenticated, service_role;
  grant execute on function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) to postgres, service_role, anon, authenticated;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'record_recommended_service_event_v1'
    and pg_get_function_identity_arguments(function_record.oid) =
      'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(function_record.oid) = 'uuid'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 'v'
    and function_record.proconfig = array['search_path=public']::text[]
    and coalesce(function_record.proacl::text, '') =
      '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '1e2fa95e2bcb13cf6cf563669855e840';

  if restored_count <> 1 then
    raise exception '0094 rollback did not restore the canonical public recommended-service event implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'record_recommended_service_event_v1'
  ) then
    raise exception '0094 rollback left the recommended-service event implementation in private';
  end if;
end
$rollback$;

commit;
