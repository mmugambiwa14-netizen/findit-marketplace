begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'legal_practitioners',
        'legal_specializations',
        'legal_bookings',
        'practitioner_reviews',
        'practitioner_payouts'
      )
  ),
  0::bigint,
  'future legal tables expose no browser RLS policies'
);

select extensions.is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in (
        'legal_practitioners',
        'legal_specializations',
        'legal_bookings',
        'practitioner_reviews',
        'practitioner_payouts'
      )
  ),
  0::bigint,
  'future legal tables grant no privileges to browser roles'
);

select extensions.ok(
  has_table_privilege('service_role', 'public.legal_practitioners', 'select'),
  'service role retains legal-row reconciliation access'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-4000-8000-000000009001',
    'legal-isolation-owner@example.test',
    '{"full_name":"Legal Isolation Owner"}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000009002',
    'legal-isolation-admin@example.test',
    '{"full_name":"Legal Isolation Admin"}',
    now(),
    now()
  );

update public.users
set role = 'admin'
where id = '00000000-0000-4000-8000-000000009002';

insert into public.services (
  id, provider_id, provider_name, title, category, status
)
values
  (
    '00000000-0000-4000-8000-000000009101',
    '00000000-0000-4000-8000-000000009001',
    'Legal Isolation Owner',
    'Visible mechanic',
    'mechanic',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000009102',
    '00000000-0000-4000-8000-000000009001',
    'Legal Isolation Owner',
    'Future legal service',
    'legal',
    'active'
  );

set local role anon;

select extensions.throws_ok(
  $$select count(*) from public.legal_practitioners$$,
  '42501',
  'permission denied for table legal_practitioners',
  'anonymous callers cannot access legal profiles'
);
select extensions.is(
  (select count(*)::bigint from public.services),
  1::bigint,
  'anonymous marketplace reads hide legal services'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
set local role authenticated;

select extensions.throws_ok(
  $$select count(*) from public.legal_practitioners$$,
  '42501',
  'permission denied for table legal_practitioners',
  'authenticated callers cannot access legal profiles'
);
select extensions.is(
  (select count(*)::bigint from public.services),
  1::bigint,
  'an owner cannot see a retained legal service through the V1 table'
);
select extensions.throws_ok(
  $$update public.services
      set category = 'legal'
    where id = '00000000-0000-4000-8000-000000009101'$$,
  '42501',
  'new row violates row-level security policy for table "services"',
  'an owner cannot convert a V1 service into a legal service'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
set local role authenticated;

select extensions.throws_ok(
  $$select count(*) from public.legal_practitioners$$,
  '42501',
  'permission denied for table legal_practitioners',
  'a browser admin has no V1 legal-table contract'
);
select extensions.is(
  (select count(*)::bigint from public.services),
  1::bigint,
  'a browser admin marketplace read also hides legal services'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select count(*) from public.legal_practitioners$$,
  'service-role legal reconciliation remains available'
);
select extensions.is(
  (select count(*)::bigint from public.services),
  2::bigint,
  'service role can reconcile retained nonlegal and legal services'
);

reset role;
select * from extensions.finish();
rollback;
