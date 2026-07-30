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
      and function_record.proname = 'submit_support_request'
      and pg_get_function_identity_arguments(function_record.oid) =
        'p_category text, p_contact_email text, p_message text, p_related_reference text'
      and pg_get_function_result(function_record.oid) = 'jsonb'
      and function_language.lanname = 'plpgsql'
      and function_record.prosecdef
      and function_record.provolatile = 'v'
      and function_record.pronargdefaults = 1
      and function_record.proconfig = array['search_path=""']::text[]
      and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '50b7df2c3d206e62dec244acf5f682d1'
  ),
  1::bigint,
  'one locked volatile SECURITY DEFINER support request implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
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
      and position('private.submit_support_request(' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public support request RPC is a volatile SECURITY INVOKER wrapper with its default argument'
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
      and function_record.proname = 'submit_support_request'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either support request function'
);

select extensions.ok(
  has_function_privilege('anon', 'public.submit_support_request(text,text,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_support_request(text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.submit_support_request(text,text,text,text)', 'EXECUTE'),
  'public support request wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege('anon', 'private.submit_support_request(text,text,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.submit_support_request(text,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.submit_support_request(text,text,text,text)', 'EXECUTE'),
  'private support request implementation preserves required execution grants'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where position('submit_support_request(' in caller.prosrc) > 0
      and not (
        caller_schema.nspname in ('public', 'private')
        and caller.proname = 'submit_support_request'
      )
  ),
  0::bigint,
  'no stored function depends on the public support request RPC identity'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies policy
    where position('submit_support_request(' in coalesce(policy.qual, '')) > 0
       or position('submit_support_request(' in coalesce(policy.with_check, '')) > 0
  ),
  0::bigint,
  'no RLS policy depends on the public support request RPC identity'
);

set local role anon;

select extensions.throws_ok(
  $$select public.submit_support_request('payments', 'guest@example.test', repeat('x', 30))$$,
  '22023',
  'invalid support category',
  'public wrapper preserves default related-reference argument and category validation'
);

select extensions.throws_ok(
  $$select private.submit_support_request('payments', 'guest@example.test', repeat('x', 30))$$,
  '22023',
  'invalid support category',
  'private implementation preserves the same default argument and category validation'
);

reset role;

select * from extensions.finish();
rollback;
