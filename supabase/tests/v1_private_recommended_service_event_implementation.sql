begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
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
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '1e2fa95e2bcb13cf6cf563669855e840'
  ),
  1::bigint,
  'one locked volatile SECURITY DEFINER recommended-service event implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
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
      and position('private.record_recommended_service_event_v1(' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public recommended-service event RPC is a locked volatile SECURITY INVOKER wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
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
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either recommended-service event function'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'public recommended-service event wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'private.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'private recommended-service event implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('record_recommended_service_event_v1(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname in ('public', 'private')
        and caller.proname = 'record_recommended_service_event_v1'
      )
  ),
  0::bigint,
  'no stored function depends on the public recommended-service event RPC identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('record_recommended_service_event_v1(' in coalesce(policy.qual, '')) > 0
       or position('record_recommended_service_event_v1(' in coalesce(policy.with_check, '')) > 0
  ),
  0::bigint,
  'no RLS policy depends on the public recommended-service event RPC identity'
);

set local role anon;

select extensions.throws_ok(
  $$select public.record_recommended_service_event_v1(
    'recommendation_impression',
    null::uuid,
    '94000000-0000-4000-8000-000000000001'::uuid,
    '94000000-0000-4000-8000-000000000002'::uuid,
    'related_services_service',
    'CATEGORY_RELATED_SERVICE',
    '{}'::jsonb
  )$$,
  '22023',
  'recommended service attribution is incomplete',
  'public wrapper preserves fail-closed incomplete-attribution validation'
);

select extensions.throws_ok(
  $$select private.record_recommended_service_event_v1(
    'recommendation_impression',
    null::uuid,
    '94000000-0000-4000-8000-000000000001'::uuid,
    '94000000-0000-4000-8000-000000000002'::uuid,
    'related_services_service',
    'CATEGORY_RELATED_SERVICE',
    '{}'::jsonb
  )$$,
  '22023',
  'recommended service attribution is incomplete',
  'private implementation preserves the same incomplete-attribution validation'
);

reset role;

select extensions.finish();
rollback;
