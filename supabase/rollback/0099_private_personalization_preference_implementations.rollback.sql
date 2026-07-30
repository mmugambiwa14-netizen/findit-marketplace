-- Roll back migration 0099 by removing the public invoker wrappers and moving
-- the three canonical personalization implementations back to public.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public'
    and p.proname in(
      'get_my_recommendation_personalization_v1',
      'set_my_recommendation_personalization_v1',
      'clear_my_recommendation_personalization_data_v1'
    )
    and l.lanname='sql'
    and not p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and position('private.'||p.proname||'(' in p.prosrc)>0;
  if public_wrapper_count<>3 then raise exception '0099 rollback expected three public personalization wrappers, found %',public_wrapper_count; end if;

  select count(*)::integer into private_implementation_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='private'
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and (
      (p.proname='get_my_recommendation_personalization_v1' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='jsonb' and l.lanname='sql' and p.provolatile='s' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ad41334dc954e18446082542450f1399')
      or (p.proname='set_my_recommendation_personalization_v1' and pg_get_function_identity_arguments(p.oid)='p_enabled boolean' and pg_get_function_result(p.oid)='jsonb' and l.lanname='plpgsql' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='fb21c63dea9003581663880ebf60d7a2')
      or (p.proname='clear_my_recommendation_personalization_data_v1' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='jsonb' and l.lanname='plpgsql' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ccc8623113af7c51df2b206ca13e16e3')
    );
  if private_implementation_count<>3 then raise exception '0099 rollback expected three private personalization implementations, found %',private_implementation_count; end if;

  drop function public.get_my_recommendation_personalization_v1();
  drop function public.set_my_recommendation_personalization_v1(boolean);
  drop function public.clear_my_recommendation_personalization_data_v1();

  alter function private.get_my_recommendation_personalization_v1() set search_path=public;
  alter function private.set_my_recommendation_personalization_v1(boolean) set search_path=public;
  alter function private.clear_my_recommendation_personalization_data_v1() set search_path=public;
  alter function private.get_my_recommendation_personalization_v1() set schema public;
  alter function private.set_my_recommendation_personalization_v1(boolean) set schema public;
  alter function private.clear_my_recommendation_personalization_data_v1() set schema public;

  revoke all on function public.get_my_recommendation_personalization_v1() from public,anon,authenticated,service_role;
  revoke all on function public.set_my_recommendation_personalization_v1(boolean) from public,anon,authenticated,service_role;
  revoke all on function public.clear_my_recommendation_personalization_data_v1() from public,anon,authenticated,service_role;
  grant execute on function public.get_my_recommendation_personalization_v1() to postgres,authenticated,service_role;
  grant execute on function public.set_my_recommendation_personalization_v1(boolean) to postgres,authenticated,service_role;
  grant execute on function public.clear_my_recommendation_personalization_data_v1() to postgres,authenticated,service_role;

  select count(*)::integer into restored_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public'
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=public']::text[]
    and coalesce(p.proacl::text,'')='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
    and (
      (p.proname='get_my_recommendation_personalization_v1' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='jsonb' and l.lanname='sql' and p.provolatile='s' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ad41334dc954e18446082542450f1399')
      or (p.proname='set_my_recommendation_personalization_v1' and pg_get_function_identity_arguments(p.oid)='p_enabled boolean' and pg_get_function_result(p.oid)='jsonb' and l.lanname='plpgsql' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='fb21c63dea9003581663880ebf60d7a2')
      or (p.proname='clear_my_recommendation_personalization_data_v1' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='jsonb' and l.lanname='plpgsql' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ccc8623113af7c51df2b206ca13e16e3')
    );
  if restored_count<>3 then raise exception '0099 rollback did not restore all canonical personalization implementations'; end if;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('get_my_recommendation_personalization_v1','set_my_recommendation_personalization_v1','clear_my_recommendation_personalization_data_v1')) then
    raise exception '0099 rollback left a personalization implementation in private';
  end if;
end;$rollback$;

commit;
