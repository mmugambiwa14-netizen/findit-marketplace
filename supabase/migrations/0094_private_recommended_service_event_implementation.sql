-- 0094_private_recommended_service_event_implementation.sql
--
-- Move the related-service recommendation-event SECURITY DEFINER implementation
-- into the non-exposed private schema. Preserve the browser RPC signature and
-- fail-open client contract through a volatile SECURITY INVOKER wrapper.

create temporary table findit_0094_expected_function (
  normalized_body_md5 text not null,
  expected_config text[] not null,
  expected_acl text not null
) on commit drop;

insert into findit_0094_expected_function values (
  '1e2fa95e2bcb13cf6cf563669855e840',
  array['search_path=public']::text[],
  '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'
);

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  private_count integer;
  public_count integer;
begin
  if (select count(*) from findit_0094_expected_function) <> 1 then
    raise exception '0094 expected exactly one recommended-service event fingerprint';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'record_recommended_service_event_v1'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
  ) then
    raise exception '0094 refused because a private recommended-service event implementation already exists';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where position('record_recommended_service_event_v1(' in coalesce(policy.qual, '')) > 0
       or position('record_recommended_service_event_v1(' in coalesce(policy.with_check, '')) > 0
  ) then
    raise exception '0094 refused because the recommended-service event function has a policy dependency';
  end if;

  select count(*)::integer into caller_count
  from pg_proc caller
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where position('record_recommended_service_event_v1(' in caller.prosrc) > 0
    and not (
      caller_schema.nspname = 'public'
      and caller.proname = 'record_recommended_service_event_v1'
      and pg_get_function_identity_arguments(caller.oid) =
        'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
    );

  if caller_count <> 0 then
    raise exception '0094 refused because % stored recommended-service event callers exist', caller_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0094_expected_function expected
  left join pg_proc function_record
    on function_record.proname = 'record_recommended_service_event_v1'
   and pg_get_function_identity_arguments(function_record.oid) =
      'p_event_type text, p_service_id uuid, p_anonymous_session_id uuid, p_recommendation_request_id uuid, p_recommendation_service text, p_reason_code text, p_context jsonb'
  left join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  left join pg_language function_language on function_language.oid = function_record.prolang
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or function_language.lanname <> 'plpgsql'
     or pg_get_function_result(function_record.oid) <> 'uuid'
     or function_record.provolatile <> 'v'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig is distinct from expected.expected_config
     or coalesce(function_record.proacl::text, '') <> expected.expected_acl
     or md5(replace(function_record.prosrc, E'\r\n', E'\n')) <> expected.normalized_body_md5;

  if mismatch_count <> 0 then
    raise exception '0094 refused because the recommended-service event fingerprint drifted';
  end if;

  alter function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) set schema private;
  alter function private.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) set search_path = '';

  revoke all on function private.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) from public, anon, authenticated, service_role;
  grant execute on function private.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) to anon, authenticated, service_role;

  create function public.record_recommended_service_event_v1(
    p_event_type text,
    p_service_id uuid,
    p_anonymous_session_id uuid,
    p_recommendation_request_id uuid,
    p_recommendation_service text,
    p_reason_code text,
    p_context jsonb
  )
  returns uuid
  language sql
  volatile
  security invoker
  set search_path = ''
  as $$
    select private.record_recommended_service_event_v1(
      p_event_type,
      p_service_id,
      p_anonymous_session_id,
      p_recommendation_request_id,
      p_recommendation_service,
      p_reason_code,
      p_context
    );
  $$;

  revoke all on function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) from public, anon, authenticated, service_role;
  grant execute on function public.record_recommended_service_event_v1(
    text, uuid, uuid, uuid, text, text, jsonb
  ) to anon, authenticated, service_role;

  select count(*)::integer into private_count
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

  select count(*)::integer into public_count
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

  if private_count <> 1 or public_count <> 1 then
    raise exception '0094 did not create the locked recommended-service event boundary';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'record_recommended_service_event_v1'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception '0094 left a PUBLIC execute grant on a recommended-service event function';
  end if;

  if not (
    has_function_privilege('anon', 'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('anon', 'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE')
  ) then
    raise exception '0094 did not preserve required recommended-service event execution grants';
  end if;
end
$migration$;
