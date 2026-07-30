-- 0096_private_recommendation_event_implementation.sql
--
-- Move the general recommendation-event SECURITY DEFINER implementation into the
-- non-exposed private schema. Preserve the public RPC identity, seven defaults,
-- attribution/privacy validation and role grants through a volatile invoker wrapper.

create temporary table findit_0096_expected_function (
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0096_expected_function values (
  '53f09ebe32d390272c80a2c411cb4e70',
  array['search_path=public']::text[],
  '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0096_expected_function) <> 1 then
    raise exception '0096 expected exactly one recommendation event fingerprint';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'record_recommendation_event'
      and pg_get_function_identity_arguments(p.oid) =
        'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
  ) then
    raise exception '0096 refused because a private recommendation event implementation already exists';
  end if;

  if exists (
    select 1 from pg_policies policy
    where position('record_recommendation_event(' in coalesce(policy.qual, '')) > 0
       or position('record_recommendation_event(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0096 refused because the recommendation event function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('record_recommendation_event(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'record_recommendation_event'
      and pg_get_function_identity_arguments(caller.oid) =
        'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    );

  if caller_count <> 0 then
    raise exception '0096 refused because % stored recommendation event callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0096_expected_function expected
  left join pg_proc p
    on p.proname = 'record_recommendation_event'
   and pg_get_function_identity_arguments(p.oid) =
      'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
  left join pg_namespace n on n.oid = p.pronamespace
  left join pg_language l on l.oid = p.prolang
  where p.oid is null
     or n.nspname <> 'public'
     or l.lanname <> 'plpgsql'
     or pg_get_function_result(p.oid) <> 'uuid'
     or p.provolatile <> 'v'
     or not p.prosecdef
     or p.pronargdefaults <> 7
     or pg_get_userbyid(p.proowner) <> 'postgres'
     or p.proconfig is distinct from expected.expected_config
     or coalesce(p.proacl::text, '') <> expected.expected_acl
     or md5(replace(p.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0096 refused because the recommendation event fingerprint drifted';
  end if;

  alter function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    set schema private;
  alter function private.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    set search_path = '';

  revoke all on function private.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    from public, anon, authenticated, service_role;
  grant execute on function private.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    to anon, authenticated, service_role;

  create function public.record_recommendation_event(
    p_event_type text,
    p_listing_id uuid default null,
    p_seller_id uuid default null,
    p_anonymous_session_id uuid default null,
    p_recommendation_request_id uuid default null,
    p_recommendation_service text default null,
    p_reason_code text default null,
    p_context jsonb default '{}'::jsonb
  )
  returns uuid
  language sql
  volatile
  security invoker
  set search_path = ''
  as $$
    select private.record_recommendation_event(
      p_event_type,
      p_listing_id,
      p_seller_id,
      p_anonymous_session_id,
      p_recommendation_request_id,
      p_recommendation_service,
      p_reason_code,
      p_context
    );
  $$;

  revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    from public, anon, authenticated, service_role;
  grant execute on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
    to anon, authenticated, service_role;

  select count(*)::integer into private_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
  where n.nspname = 'private'
    and p.proname = 'record_recommendation_event'
    and pg_get_function_identity_arguments(p.oid) =
      'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(p.oid) = 'uuid'
    and l.lanname = 'plpgsql'
    and p.prosecdef
    and p.provolatile = 'v'
    and p.pronargdefaults = 7
    and p.proconfig = array['search_path=""']::text[]
    and md5(replace(p.prosrc, E'\r\n', E'\n')) = '53f09ebe32d390272c80a2c411cb4e70';

  select count(*)::integer into public_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.proname = 'record_recommendation_event'
    and pg_get_function_identity_arguments(p.oid) =
      'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    and pg_get_function_result(p.oid) = 'uuid'
    and l.lanname = 'sql'
    and not p.prosecdef
    and p.provolatile = 'v'
    and p.pronargdefaults = 7
    and p.proconfig = array['search_path=""']::text[]
    and position('private.record_recommendation_event(' in p.prosrc) > 0;

  if private_count <> 1 or public_count <> 1 then
    raise exception '0096 did not create the locked recommendation event boundary';
  end if;

  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
    where n.nspname in ('public', 'private')
      and p.proname = 'record_recommendation_event'
      and pg_get_function_identity_arguments(p.oid) =
        'p_event_type text, p_listing_id uuid, p_seller_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0096 left a PUBLIC execute grant on a recommendation event function';
  end if;

  if not (
    has_function_privilege('anon', 'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('anon', 'private.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
  ) then
    raise exception '0096 did not preserve required recommendation event execution grants';
  end if;
end
$migration$;
