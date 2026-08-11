begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('82000000-0000-4000-8000-000000000001', 'verified-owner@example.test', '{"full_name":"Verified Owner"}', now(), now()),
  ('82000000-0000-4000-8000-000000000002', 'late-profile@example.test', '{"full_name":"Late Profile Owner"}', now(), now()),
  ('82000000-0000-4000-8000-000000000003', 'rejected-owner@example.test', '{"full_name":"Rejected Owner"}', now(), now()),
  ('82000000-0000-4000-8000-000000000004', 'verified-admin@example.test', '{"full_name":"Verified Admin"}', now(), now());

update public.users
set role = 'admin', super_admin = true
where id = '82000000-0000-4000-8000-000000000004';

insert into public.business_profiles (
  id, user_id, company_name, business_type, phone, email, city, description,
  verified, verification_status
) values
  (
    '82000000-0000-4000-8000-000000000101',
    '82000000-0000-4000-8000-000000000001',
    'Verified Journey Motors', 'car_dealership', '+263700000101',
    'verified-owner@example.test', 'Harare',
    'Business profile used to certify approval state synchronization.', false, 'none'
  ),
  (
    '82000000-0000-4000-8000-000000000103',
    '82000000-0000-4000-8000-000000000003',
    'Rejected Journey Business', 'other', '+263700000103',
    'rejected-owner@example.test', 'Bulawayo',
    'Business profile used to certify a rejected application state.', false, 'none'
  );

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values
  (
    '82000000-0000-4000-8000-000000000201',
    '82000000-0000-4000-8000-000000000001',
    'Verified Journey Motors', 'Verified Owner', 'verified-owner@example.test',
    '+263700000101', 'ZW', 'Harare',
    'A complete business application used for verified journey certification.',
    '1-10', 'submitted'
  ),
  (
    '82000000-0000-4000-8000-000000000202',
    '82000000-0000-4000-8000-000000000002',
    'Late Profile Company', 'Late Profile Owner', 'late-profile@example.test',
    '+263700000102', 'ZW', 'Mutare',
    'An approved application created before its public business profile.',
    '1-10', 'approved'
  ),
  (
    '82000000-0000-4000-8000-000000000203',
    '82000000-0000-4000-8000-000000000003',
    'Rejected Journey Business', 'Rejected Owner', 'rejected-owner@example.test',
    '+263700000103', 'ZW', 'Bulawayo',
    'A complete business application used to certify rejection synchronization.',
    '1-10', 'submitted'
  );

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values
  ('82000000-0000-4000-8000-000000000301', '82000000-0000-4000-8000-000000000201', '82000000-0000-4000-8000-000000000001', 'car', 'pending'),
  ('82000000-0000-4000-8000-000000000302', '82000000-0000-4000-8000-000000000202', '82000000-0000-4000-8000-000000000002', 'property', 'approved'),
  ('82000000-0000-4000-8000-000000000303', '82000000-0000-4000-8000-000000000203', '82000000-0000-4000-8000-000000000003', 'service', 'pending');

select extensions.is(
  (select verification_status::text from public.business_profiles where id = '82000000-0000-4000-8000-000000000101'),
  'pending',
  'submitted application synchronizes an existing profile to pending'
);

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.admin_review_business_category(
  '82000000-0000-4000-8000-000000000301',
  'approve',
  null
);
reset role;

select extensions.ok(
  (select verified from public.business_profiles where id = '82000000-0000-4000-8000-000000000101'),
  'an approved category marks the business profile verified'
);

select extensions.is(
  (select verification_status::text from public.business_profiles where id = '82000000-0000-4000-8000-000000000101'),
  'verified',
  'an approved category uses the canonical verified enum value'
);

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '82000000-0000-4000-8000-000000000001'
     and event_type = 'business_category_updated'),
  1::bigint,
  'the existing curated notification trigger informs the approved owner once'
);

insert into public.business_profiles (
  id, user_id, company_name, business_type, phone, email, city, description,
  verified, verification_status
) values (
  '82000000-0000-4000-8000-000000000102',
  '82000000-0000-4000-8000-000000000002',
  'Late Profile Company', 'real_estate_agency', '+263700000102',
  'late-profile@example.test', 'Mutare',
  'Profile created after approval to certify bootstrap synchronization.', false, 'none'
);

select extensions.ok(
  (select verified from public.business_profiles where id = '82000000-0000-4000-8000-000000000102'),
  'a profile created after approval is bootstrapped to verified'
);

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.admin_review_business_application(
  '82000000-0000-4000-8000-000000000203',
  'reject',
  'Certification rejection'
);
reset role;

select extensions.is(
  (select verification_status::text from public.business_profiles where id = '82000000-0000-4000-8000-000000000103'),
  'rejected',
  'a rejected application synchronizes the owner profile to rejected'
);

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.throws_ok(
  $$update public.business_profiles
    set verified = false, verification_status = 'none'
    where id = '82000000-0000-4000-8000-000000000101'$$,
  'P0001',
  'Business verification fields are admin controlled',
  'a business owner cannot remove or assign verification directly'
);
reset role;

set local role anon;
select extensions.ok(
  (select verified from public.business_profiles_public where id = '82000000-0000-4000-8000-000000000101'),
  'public callers can see the approved boolean'
);
reset role;

select extensions.is(
  (select count(*)::bigint from information_schema.columns
   where table_schema = 'public'
     and table_name = 'business_profiles_public'
     and column_name in ('verification_status', 'registration_number', 'issuing_body')),
  0::bigint,
  'public callers cannot inspect moderation status or registration evidence'
);

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.admin_review_business_category(
  '82000000-0000-4000-8000-000000000301',
  'suspend',
  'Certification suspension'
);
reset role;

select extensions.ok(
  not (select verified from public.business_profiles where id = '82000000-0000-4000-8000-000000000101'),
  'suspending the final approved category removes the public verified state'
);

select extensions.is(
  (select verification_status::text from public.business_profiles where id = '82000000-0000-4000-8000-000000000101'),
  'rejected',
  'a business with no approved or pending categories follows the rejected application state'
);

select * from extensions.finish();
rollback;
