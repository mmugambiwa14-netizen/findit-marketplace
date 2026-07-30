-- Roll back migration 0098 by removing the public invoker wrappers and moving
-- the three canonical notification read implementations back to public.

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
    and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read')
    and l.lanname='sql'
    and not p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and position('private.'||p.proname||'(' in p.prosrc)>0;
  if public_wrapper_count<>3 then raise exception '0098 rollback expected three public notification wrappers, found %',public_wrapper_count; end if;

  select count(*)::integer into private_implementation_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='private'
    and l.lanname='plpgsql'
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and (
      (p.proname='notification_unread_count' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='bigint' and p.provolatile='s' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ccffc075095c6507a45b500f8165f230')
      or (p.proname='mark_notification_read' and pg_get_function_identity_arguments(p.oid)='p_notification_id uuid' and pg_get_function_result(p.oid)='boolean' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='bb51925c94fba361f2b69e26471ac6ec')
      or (p.proname='mark_all_notifications_read' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='integer' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='2086b0e85fdec8b3949a82f17d4a58c1')
    );
  if private_implementation_count<>3 then raise exception '0098 rollback expected three private notification implementations, found %',private_implementation_count; end if;

  drop function public.notification_unread_count();
  drop function public.mark_notification_read(uuid);
  drop function public.mark_all_notifications_read();

  alter function private.notification_unread_count() set search_path=public;
  alter function private.mark_notification_read(uuid) set search_path=public;
  alter function private.mark_all_notifications_read() set search_path=public;
  alter function private.notification_unread_count() set schema public;
  alter function private.mark_notification_read(uuid) set schema public;
  alter function private.mark_all_notifications_read() set schema public;

  revoke all on function public.notification_unread_count() from public,anon,authenticated,service_role;
  revoke all on function public.mark_notification_read(uuid) from public,anon,authenticated,service_role;
  revoke all on function public.mark_all_notifications_read() from public,anon,authenticated,service_role;
  grant execute on function public.notification_unread_count() to postgres,authenticated,service_role;
  grant execute on function public.mark_notification_read(uuid) to postgres,authenticated,service_role;
  grant execute on function public.mark_all_notifications_read() to postgres,authenticated,service_role;

  select count(*)::integer into restored_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public'
    and l.lanname='plpgsql'
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=public']::text[]
    and coalesce(p.proacl::text,'')='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and (
      (p.proname='notification_unread_count' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='bigint' and p.provolatile='s' and md5(replace(p.prosrc,E'\r\n',E'\n'))='ccffc075095c6507a45b500f8165f230')
      or (p.proname='mark_notification_read' and pg_get_function_identity_arguments(p.oid)='p_notification_id uuid' and pg_get_function_result(p.oid)='boolean' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='bb51925c94fba361f2b69e26471ac6ec')
      or (p.proname='mark_all_notifications_read' and pg_get_function_identity_arguments(p.oid)='' and pg_get_function_result(p.oid)='integer' and p.provolatile='v' and md5(replace(p.prosrc,E'\r\n',E'\n'))='2086b0e85fdec8b3949a82f17d4a58c1')
    );
  if restored_count<>3 then raise exception '0098 rollback did not restore all canonical notification implementations'; end if;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read')) then
    raise exception '0098 rollback left a notification read implementation in private';
  end if;
end;$rollback$;

commit;
