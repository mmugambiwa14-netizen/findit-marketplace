begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(13);

select extensions.is(
  (
    select count(*)::integer
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'has_verified_mfa_factor',
        'has_required_admin_assurance'
      )
      and pg_get_function_identity_arguments(function_record.oid) = 'p_user_id uuid'
      and function_record.prosecdef
      and function_record.proconfig = array['search_path=""']::text[]
  ),
  2,
  'both locked private MFA assurance helpers exist'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'has_verified_mfa_factor',
        'has_required_admin_assurance',
        'is_admin',
        'is_super_admin'
      )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0,
  'no MFA or administrator authorization helper grants EXECUTE to PUBLIC'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-4000-8000-000000009401',
    'mfa-admin@example.test',
    '{"full_name":"MFA Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000009402',
    'mfa-user@example.test',
    '{"full_name":"MFA User"}'::jsonb,
    now(),
    now()
  );

-- The founder-identity trigger explicitly permits direct postgres recovery and
-- deterministic SQL tests. API sessions cannot use this path.
update public.users
set role = 'admin',
    super_admin = true,
    status = 'active'
where id = '00000000-0000-4000-8000-000000009401';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009401',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009401","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select extensions.is(
  public.is_admin(),
  true,
  'aal1 administrator without a verified factor can still reach enrolment paths'
);

select extensions.lives_ok(
  $$select count(*) from public.admin_list_business_applications(null, 1, null)$$,
  'aal1 administrator without a verified factor may call an admin RPC'
);

reset role;

insert into auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  created_at,
  updated_at,
  secret
) values (
  '00000000-0000-4000-8000-000000009411',
  '00000000-0000-4000-8000-000000009401',
  'F-027 test TOTP',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009401',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009401","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select extensions.is(
  public.is_admin(),
  false,
  'aal1 administrator with a verified factor fails the server admin predicate'
);

select extensions.is(
  public.is_super_admin(),
  false,
  'aal1 administrator with a verified factor fails the server super-admin predicate'
);

select extensions.throws_like(
  $$select count(*) from public.admin_list_business_applications(null, 1, null)$$,
  '%Admin access required%',
  'aal1 administrator with a verified factor is denied by an admin RPC'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009401',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009401","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select extensions.is(
  public.is_admin(),
  true,
  'aal2 administrator with a verified factor passes the server admin predicate'
);

select extensions.is(
  public.is_super_admin(),
  true,
  'aal2 administrator with a verified factor passes the server super-admin predicate'
);

select extensions.lives_ok(
  $$select count(*) from public.admin_list_business_applications(null, 1, null)$$,
  'aal2 administrator with a verified factor may call an admin RPC'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000009402',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009402","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select extensions.is(
  public.is_admin(),
  false,
  'aal2 ordinary user remains outside the server admin predicate'
);

select extensions.is(
  public.is_super_admin(),
  false,
  'aal2 ordinary user remains outside the server super-admin predicate'
);

select extensions.throws_like(
  $$select count(*) from public.admin_list_business_applications(null, 1, null)$$,
  '%Admin access required%',
  'aal2 ordinary user remains denied by an admin RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select * from extensions.finish();
rollback;
