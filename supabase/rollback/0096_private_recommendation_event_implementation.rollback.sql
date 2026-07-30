-- Roll back migration 0096 by removing the public invoker wrapper and moving
-- the canonical recommendation-event SECURITY DEFINER implementation back to
-- public with its original search path, defaults and grants.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.proname='record_recommendation_event'
    and pg_get_function_identity_arguments(p.oid)='p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(p.oid)='uuid' and l.lanname='sql' and not p.prosecdef
    and p.provolatile='v' and p.pronargdefaults=7 and p.proconfig=array['search_path=""']::text[]
    and position('private.record_recommendation_event(' in p.prosrc)>0;
  if public_wrapper_count<>1 then raise exception '0096 rollback expected one public recommendation event wrapper, found %',public_wrapper_count; end if;

  select count(*)::integer into private_implementation_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='private' and p.proname='record_recommendation_event'
    and pg_get_function_identity_arguments(p.oid)='p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(p.oid)='uuid' and l.lanname='plpgsql' and p.prosecdef
    and p.provolatile='v' and p.pronargdefaults=7 and p.proconfig=array['search_path=""']::text[]
    and md5(replace(p.prosrc,E'\r\n',E'\n'))='53f09ebe32d390272c80a2c411cb4e70';
  if private_implementation_count<>1 then raise exception '0096 rollback expected one private recommendation event implementation, found %',private_implementation_count; end if;

  drop function public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb);
  alter function private.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb) set search_path=public;
  alter function private.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb) set schema public;

  revoke all on function public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
  grant execute on function public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb) to postgres,anon,authenticated,service_role;

  select count(*)::integer into restored_count
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.proname='record_recommendation_event'
    and pg_get_function_identity_arguments(p.oid)='p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(p.oid)='uuid' and l.lanname='plpgsql' and p.prosecdef
    and p.provolatile='v' and p.pronargdefaults=7 and p.proconfig=array['search_path=public']::text[]
    and coalesce(p.proacl::text,'')='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(p.prosrc,E'\r\n',E'\n'))='53f09ebe32d390272c80a2c411cb4e70';
  if restored_count<>1 then raise exception '0096 rollback did not restore the canonical public recommendation event implementation'; end if;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='record_recommendation_event') then
    raise exception '0096 rollback left the recommendation event implementation in private';
  end if;
end
$rollback$;

commit;
