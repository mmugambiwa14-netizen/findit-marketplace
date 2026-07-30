-- 0099_private_personalization_preference_implementations.sql
--
-- Move the authenticated personalization preference read/write/clear SECURITY
-- DEFINER implementations into private. Preserve the three public RPC identities,
-- results, volatility and authenticated/service grants through invoker wrappers.

create temporary table findit_0099_expected_functions (
  function_name text not null,
  identity_arguments text not null,
  result_type text not null,
  language_name text not null,
  volatility "char" not null,
  normalized_body_md5 text not null,
  primary key(function_name, identity_arguments)
) on commit drop;

insert into findit_0099_expected_functions values
  ('get_my_recommendation_personalization_v1', '', 'jsonb', 'sql', 's', 'ad41334dc954e18446082542450f1399'),
  ('set_my_recommendation_personalization_v1', 'p_enabled boolean', 'jsonb', 'plpgsql', 'v', 'fb21c63dea9003581663880ebf60d7a2'),
  ('clear_my_recommendation_personalization_data_v1', '', 'jsonb', 'plpgsql', 'v', 'ccc8623113af7c51df2b206ca13e16e3');

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0099_expected_functions) <> 3 then
    raise exception '0099 expected exactly three personalization fingerprints';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in(
        'get_my_recommendation_personalization_v1',
        'set_my_recommendation_personalization_v1',
        'clear_my_recommendation_personalization_data_v1'
      )
  ) then
    raise exception '0099 refused because a private personalization implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('get_my_recommendation_personalization_v1(' in coalesce(policy.qual,''))>0
       or position('get_my_recommendation_personalization_v1(' in coalesce(policy.with_check,''))>0
       or position('set_my_recommendation_personalization_v1(' in coalesce(policy.qual,''))>0
       or position('set_my_recommendation_personalization_v1(' in coalesce(policy.with_check,''))>0
       or position('clear_my_recommendation_personalization_data_v1(' in coalesce(policy.qual,''))>0
       or position('clear_my_recommendation_personalization_data_v1(' in coalesce(policy.with_check,''))>0
  ) then
    raise exception '0099 refused because a personalization function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace n on n.oid=caller.pronamespace
  where (
    position('get_my_recommendation_personalization_v1(' in caller.prosrc)>0
    or position('set_my_recommendation_personalization_v1(' in caller.prosrc)>0
    or position('clear_my_recommendation_personalization_data_v1(' in caller.prosrc)>0
  ) and caller.proname not in(
    'get_my_recommendation_personalization_v1',
    'set_my_recommendation_personalization_v1',
    'clear_my_recommendation_personalization_data_v1'
  );

  if caller_count<>0 then
    raise exception '0099 refused because % stored personalization callers exist',caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0099_expected_functions expected
  left join pg_proc p
    on p.proname=expected.function_name
   and pg_get_function_identity_arguments(p.oid)=expected.identity_arguments
  left join pg_namespace n on n.oid=p.pronamespace
  left join pg_language l on l.oid=p.prolang
  where p.oid is null
     or n.nspname<>'public'
     or l.lanname<>expected.language_name
     or pg_get_function_result(p.oid)<>expected.result_type
     or p.provolatile<>expected.volatility
     or not p.prosecdef
     or p.pronargdefaults<>0
     or pg_get_userbyid(p.proowner)<>'postgres'
     or p.proconfig is distinct from array['search_path=public']::text[]
     or coalesce(p.proacl::text,'')<>'{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'
     or md5(replace(p.prosrc,E'\r\n',E'\n'))<>expected.normalized_body_md5;

  if mismatch_count<>0 then
    raise exception '0099 refused because a personalization fingerprint drifted';
  end if;

  alter function public.get_my_recommendation_personalization_v1() set schema private;
  alter function public.set_my_recommendation_personalization_v1(boolean) set schema private;
  alter function public.clear_my_recommendation_personalization_data_v1() set schema private;

  alter function private.get_my_recommendation_personalization_v1() set search_path='';
  alter function private.set_my_recommendation_personalization_v1(boolean) set search_path='';
  alter function private.clear_my_recommendation_personalization_data_v1() set search_path='';

  revoke all on function private.get_my_recommendation_personalization_v1() from public,anon,authenticated,service_role;
  revoke all on function private.set_my_recommendation_personalization_v1(boolean) from public,anon,authenticated,service_role;
  revoke all on function private.clear_my_recommendation_personalization_data_v1() from public,anon,authenticated,service_role;
  grant execute on function private.get_my_recommendation_personalization_v1() to authenticated,service_role;
  grant execute on function private.set_my_recommendation_personalization_v1(boolean) to authenticated,service_role;
  grant execute on function private.clear_my_recommendation_personalization_data_v1() to authenticated,service_role;

  create function public.get_my_recommendation_personalization_v1()
  returns jsonb
  language sql
  stable
  security invoker
  set search_path=''
  as $$select private.get_my_recommendation_personalization_v1();$$;

  create function public.set_my_recommendation_personalization_v1(p_enabled boolean)
  returns jsonb
  language sql
  volatile
  security invoker
  set search_path=''
  as $$select private.set_my_recommendation_personalization_v1(p_enabled);$$;

  create function public.clear_my_recommendation_personalization_data_v1()
  returns jsonb
  language sql
  volatile
  security invoker
  set search_path=''
  as $$select private.clear_my_recommendation_personalization_data_v1();$$;

  revoke all on function public.get_my_recommendation_personalization_v1() from public,anon,authenticated,service_role;
  revoke all on function public.set_my_recommendation_personalization_v1(boolean) from public,anon,authenticated,service_role;
  revoke all on function public.clear_my_recommendation_personalization_data_v1() from public,anon,authenticated,service_role;
  grant execute on function public.get_my_recommendation_personalization_v1() to authenticated,service_role;
  grant execute on function public.set_my_recommendation_personalization_v1(boolean) to authenticated,service_role;
  grant execute on function public.clear_my_recommendation_personalization_data_v1() to authenticated,service_role;

  select count(*)::integer into private_count
  from findit_0099_expected_functions expected
  join pg_proc p on p.proname=expected.function_name and pg_get_function_identity_arguments(p.oid)=expected.identity_arguments
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='private'
    and l.lanname=expected.language_name
    and pg_get_function_result(p.oid)=expected.result_type
    and p.provolatile=expected.volatility
    and p.prosecdef
    and p.pronargdefaults=0
    and p.proconfig=array['search_path=""']::text[]
    and md5(replace(p.prosrc,E'\r\n',E'\n'))=expected.normalized_body_md5;

  select count(*)::integer into public_count
  from findit_0099_expected_functions expected
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
    raise exception '0099 did not create the locked personalization boundary';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
    where n.nspname in('public','private')
      and p.proname in(
        'get_my_recommendation_personalization_v1',
        'set_my_recommendation_personalization_v1',
        'clear_my_recommendation_personalization_data_v1'
      )
      and privilege.grantee=0
      and privilege.privilege_type='EXECUTE'
  ) then
    raise exception '0099 left a PUBLIC execute grant on a personalization function';
  end if;

  if not(
    has_function_privilege('authenticated','public.get_my_recommendation_personalization_v1()','EXECUTE')
    and has_function_privilege('service_role','public.get_my_recommendation_personalization_v1()','EXECUTE')
    and has_function_privilege('authenticated','public.set_my_recommendation_personalization_v1(boolean)','EXECUTE')
    and has_function_privilege('service_role','public.set_my_recommendation_personalization_v1(boolean)','EXECUTE')
    and has_function_privilege('authenticated','public.clear_my_recommendation_personalization_data_v1()','EXECUTE')
    and has_function_privilege('service_role','public.clear_my_recommendation_personalization_data_v1()','EXECUTE')
    and has_function_privilege('authenticated','private.get_my_recommendation_personalization_v1()','EXECUTE')
    and has_function_privilege('service_role','private.get_my_recommendation_personalization_v1()','EXECUTE')
    and has_function_privilege('authenticated','private.set_my_recommendation_personalization_v1(boolean)','EXECUTE')
    and has_function_privilege('service_role','private.set_my_recommendation_personalization_v1(boolean)','EXECUTE')
    and has_function_privilege('authenticated','private.clear_my_recommendation_personalization_data_v1()','EXECUTE')
    and has_function_privilege('service_role','private.clear_my_recommendation_personalization_data_v1()','EXECUTE')
  ) then
    raise exception '0099 did not preserve required personalization execution grants';
  end if;

  if has_function_privilege('anon','public.get_my_recommendation_personalization_v1()','EXECUTE')
     or has_function_privilege('anon','public.set_my_recommendation_personalization_v1(boolean)','EXECUTE')
     or has_function_privilege('anon','public.clear_my_recommendation_personalization_data_v1()','EXECUTE') then
    raise exception '0099 exposed an authenticated personalization RPC to anon';
  end if;
end;$migration$;
