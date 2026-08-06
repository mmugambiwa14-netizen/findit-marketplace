begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  coalesce((
    select 'security_invoker=true' = any(coalesce(view_class.reloptions, '{}'::text[]))
    from pg_class as view_class
    join pg_namespace as view_schema on view_schema.oid = view_class.relnamespace
    where view_schema.nspname = 'public'
      and view_class.relname = 'business_profiles_public'
  ), false),
  'public business-profile view executes with invoker semantics'
);

select extensions.ok(
  coalesce((
    select 'security_barrier=true' = any(coalesce(view_class.reloptions, '{}'::text[]))
    from pg_class as view_class
    join pg_namespace as view_schema on view_schema.oid = view_class.relnamespace
    where view_schema.nspname = 'public'
      and view_class.relname = 'business_profiles_public'
  ), false),
  'public business-profile view retains a security barrier'
);

select extensions.ok(
  to_regprocedure('private.public_business_profiles()') is not null,
  'least-column projection function exists outside the exposed public schema'
);

select extensions.ok(
  to_regprocedure('public.public_business_profiles()') is null,
  'least-column projection function is not exposed as a public RPC'
);

select extensions.is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'business_profiles_public'
      and grantee in ('anon', 'authenticated')
      and privilege_type <> 'SELECT'
  ),
  0::bigint,
  'browser roles have no write or ownership-like privileges on the public view'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', 'active-business@example.test', '{"full_name":"Active Business Owner"}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'suspended-business@example.test', '{"full_name":"Suspended Business Owner"}', now(), now());

update public.users
set status = 'suspended'
where id = '81000000-0000-4000-8000-000000000002';

insert into public.business_profiles (
  id,
  user_id,
  company_name,
  business_type,
  registration_number,
  issuing_body,
  phone,
  email,
  city,
  description,
  verified,
  verification_status
)
values
  (
    '81000000-0000-4000-8000-000000000101',
    '81000000-0000-4000-8000-000000000001',
    'Public Projection Test Business',
    'real_estate_agency',
    'PRIVATE-REGISTRATION-ONE',
    'Private Issuer One',
    '+263700000001',
    'public-business@example.test',
    'Harare',
    'Active public business-profile projection fixture.',
    true,
    'verified'
  ),
  (
    '81000000-0000-4000-8000-000000000102',
    '81000000-0000-4000-8000-000000000002',
    'Suspended Projection Test Business',
    'car_dealership',
    'PRIVATE-REGISTRATION-TWO',
    'Private Issuer Two',
    '+263700000002',
    'suspended-business@example.test',
    'Bulawayo',
    'Suspended owner fixture that must not appear publicly.',
    false,
    'none'
  );

set local role anon;

select extensions.is(
  (
    select count(*)::bigint
    from public.business_profiles_public
    where id = '81000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'anonymous callers can read an active public business profile'
);

select extensions.ok(
  (select verified from public.business_profiles_public
   where id = '81000000-0000-4000-8000-000000000101'),
  'anonymous callers can see whether an active business is approved'
);

select extensions.is(
  (
    select count(*)::bigint
    from public.business_profiles_public
    where id = '81000000-0000-4000-8000-000000000102'
  ),
  0::bigint,
  'anonymous callers cannot read a profile owned by a suspended account'
);

select extensions.throws_matching(
  $$delete from public.business_profiles_public where false$$,
  '.*permission denied.*|.*cannot delete.*',
  'anonymous callers cannot mutate the public projection'
);

reset role;

select extensions.is(
  (
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_profiles_public'
      and column_name in ('registration_number', 'issuing_body', 'verification_status')
  ),
  0::bigint,
  'private registration and moderation fields are absent from the projection'
);

select extensions.finish();
rollback;
