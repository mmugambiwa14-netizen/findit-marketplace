-- 0098_private_notification_read_implementations.sql
--
-- Move the authenticated notification unread/read-state SECURITY DEFINER
-- implementations into private. Preserve all three public RPC identities,
-- volatility, results and authenticated/service grants through invoker wrappers.

create temporary table findit_0098_expected_functions (
  function_name text not null,
  identity_arguments text not null,
  result_type text not null,
  volatility "char" not null,
  normalized_body_md5 text not null,
  primary key(function_name, identity_arguments)
) on commit drop;

insert into findit_0098_expected_functions values
  ('notification_unread_count', '', 'bigint', 's', 'ccffc075095c6507a45b500f8165f230'),
  ('mark_notification_read', 'p_notification_id uuid', 'boolean', 'v', 'bb51925c94fba361f2b69e26471ac6ec'),
  ('mark_all_notifications_read', '', 'integer', 'v', '2086b0e85fdec8b3949a82f17d4a58c1');

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0098_expected_functions) <> 3 then
    raise exception '0098 expected exactly three notification read fingerprints';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read')
  ) then
    raise exception '0098 refused because a private notification read implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('notification_unread_count(' in coalesce(policy.qual,''))>0
       or position('notification_unread_count(' in coalesce(policy.with_check,''))>0
       or position('mark_notification_read(' in coalesce(policy.qual,''))>0
       or position('mark_notification_read(' in coalesce(policy.with_check,''))>0
       or position('mark_all_notifications_read(' in coalesce(policy.qual,''))>0
       or position('mark_all_notifications_read(' in coalesce(policy.with_check,''))>0
  ) then
    raise exception '0098 refused because a notification read function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace n on n.oid=caller.pronamespace
  where (
    position('notification_unread_count(' in caller.prosrc)>0
    or position('mark_notification_read(' in caller.prosrc)>0
    or position('mark_all_notifications_read(' in caller.prosrc)>0
  ) and caller.proname not in('notification_unread_count','mark_notification_read','mark_all_notifications_read');

  if caller_count<>0 then
    raise exception '0098 refused because % stored notification read callers exist',caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0098_expected_functions expected
  left join pg_proc p
    on p.proname=expected.function_name
   and pg_get_function_identity_arguments(p.oid)=expected.identity_arguments
  left join pg_namespace n on n.oid=p.pronamespace
  left join pg_language l on l.oid=p.prolang
  where p.oid is null
     or n.nspname<>'public'
     or l.lanname<>'plpgsql'
     or pg_get_function_result(p.oid)<>expected.result_type
     or p.provolatile<>expected.volatility
     or not p.prosecdef
     or p.pronargdefaults<>0
     or pg_get_userbyid(p.proowner)<>'postgres'
     or p.proconfig is distinct from array['search_path=public']::text[]
     or coalesce(p.proacl::text,'')<>'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
     or md5(replace(p.prosrc,E'\r\n',E'\n'))<>expected.normalized_body_md5;

  if mismatch_count<>0 then
    raise exception '0098 refused because a notification read fingerprint drifted';
  end if;

  alter function public.notification_unread_count() set schema private;
  alter function public.mark_notification_read(uuid) set schema private;
  alter function public.mark_all_notifications_read() set schema private;

  alter function private.notification_unread_count() set search_path='';
  alter function private.mark_notification_read(uuid) set search_path='';
  alter function private.mark_all_notifications_read() set search_path='';

  revoke all on function private.notification_unread_count() from public,anon,authenticated,service_role;
  revoke all on function private.mark_notification_read(uuid) from public,anon,authenticated,service_role;
  revoke all on function private.mark_all_notifications_read() from public,anon,authenticated,service_role;
  grant execute on function private.notification_unread_count() to authenticated,service_role;
  grant execute on function private.mark_notification_read(uuid) to authenticated,service_role;
  grant execute on function private.mark_all_notifications_read() to authenticated,service_role;

  create function public.notification_unread_count()
  returns bigint
  language sql
  stable
  security invoker
  set search_path=''
  as $$select private.notification_unread_count();$$;

  create function public.mark_notification_read(p_notification_id uuid)
  returns boolean
  language sql
  volatile
  security invoker
  set search_path=''
  as $$select private.mark_notification_read(p_notification_id);$$;

  create function public.mark_all_notifications_read()
  returns integer
  language sql
  volatile
  security invoker
  set search_path=''
  as $$select private.mark_all_notifications_read();$$;

  revoke all on function public.notification_unread_count() from public,anon,authenticated,service_role;
  revoke all on function public.mark_notification_read(uuid) from public,anon,authenticated,service_role;
  revoke all on function public.mark_all_notifications_read() from public,anon,authenticated,service_role;
  grant execute on function public.notification_unread_count() to authenticated,service_role;
  grant execute on function public.mark_notification_read(uuid) to authenticated,service_role;
  grant execute on function public.mark_all_notifications_read() to authenticated,service_role;

  select count(*)::integer into private_count
  from findit_0098_expected_functions expected
  join pg_proc p on p.proname=expected.function_name and pg_get_function_identity_arguments(p.oid)=expected.identity_arguments
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='private'
    and l.lanname='plpgsql'
    and pg_get_function_result(p.oid)=expected.result_type
    and p.provolatile=expected.volatility
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and md5(replace(p.prosrc,E'\r\n',E'\n'))=expected.normalized_body_md5;

  select count(*)::integer into public_count
  from findit_0098_expected_functions expected
  join pg_proc p on p.proname=expected.function_name and pg_get_function_identity_arguments(p.oid)=expected.identity_arguments
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public'
    and l.lanname='sql'
    and pg_get_function_result(p.oid)=expected.result_type
    and p.provolatile=expected.volatility
    and not p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and position('private.'||expected.function_name||'(' in p.prosrc)>0;

  if private_count<>3 or public_count<>3 then
    raise exception '0098 did not create the locked notification read boundary';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
    where n.nspname in('public','private')
      and p.proname in('notification_unread_count','mark_notification_read','mark_all_notifications_read')
      and privilege.grantee=0
      and privilege.privilege_type='EXECUTE'
  ) then
    raise exception '0098 left a PUBLIC execute grant on a notification read function';
  end if;

  if not(
    has_function_privilege('authenticated','public.notification_unread_count()','EXECUTE')
    and has_function_privilege('service_role','public.notification_unread_count()','EXECUTE')
    and has_function_privilege('authenticated','public.mark_notification_read(uuid)','EXECUTE')
    and has_function_privilege('service_role','public.mark_notification_read(uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.mark_all_notifications_read()','EXECUTE')
    and has_function_privilege('service_role','public.mark_all_notifications_read()','EXECUTE')
    and has_function_privilege('authenticated','private.notification_unread_count()','EXECUTE')
    and has_function_privilege('service_role','private.notification_unread_count()','EXECUTE')
    and has_function_privilege('authenticated','private.mark_notification_read(uuid)','EXECUTE')
    and has_function_privilege('service_role','private.mark_notification_read(uuid)','EXECUTE')
    and has_function_privilege('authenticated','private.mark_all_notifications_read()','EXECUTE')
    and has_function_privilege('service_role','private.mark_all_notifications_read()','EXECUTE')
  ) then
    raise exception '0098 did not preserve required notification read execution grants';
  end if;

  if has_function_privilege('anon','public.notification_unread_count()','EXECUTE')
     or has_function_privilege('anon','public.mark_notification_read(uuid)','EXECUTE')
     or has_function_privilege('anon','public.mark_all_notifications_read()','EXECUTE') then
    raise exception '0098 exposed an authenticated notification RPC to anon';
  end if;
end;$migration$;
