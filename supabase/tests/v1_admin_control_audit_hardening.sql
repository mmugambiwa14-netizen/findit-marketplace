begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('83000000-0000-4000-8000-000000000001', 'admin-control-admin@example.test', '{"full_name":"Control Admin"}', now(), now()),
  ('83000000-0000-4000-8000-000000000002', 'admin-control-owner@example.test', '{"full_name":"Control Owner"}', now(), now()),
  ('83000000-0000-4000-8000-000000000003', 'admin-control-user@example.test', '{"full_name":"Control User"}', now(), now());

update public.users
set role = 'admin', super_admin = true, status = 'active'
where id = '83000000-0000-4000-8000-000000000001';

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '83000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000002',
  'Admin Control Business', 'Control Owner', 'admin-control-owner@example.test',
  '+263700000301', 'ZW', 'Harare',
  'Disposable application fixture for admin transition and audit certification.',
  '1-10', 'submitted'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values (
  '83000000-0000-4000-8000-000000000201',
  '83000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000002',
  'car', 'pending'
);

insert into public.managed_listing_requests (
  id, requester_user_id, category, owner_name, contact_email, contact_phone,
  country_code, city, item_summary, status
) values (
  '83000000-0000-4000-8000-000000000301',
  '83000000-0000-4000-8000-000000000002',
  'machinery', 'Control Owner', 'admin-control-owner@example.test', '+263700000301',
  'ZW', 'Harare',
  'Disposable managed request for state transition and audit certification.',
  'submitted'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"83000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.throws_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'start_review', null
  )$$,
  '42501', 'Admin access required',
  'ordinary users cannot review a business application'
);
select extensions.throws_ok(
  $$select public.admin_update_managed_listing_request(
    '83000000-0000-4000-8000-000000000301', 'reviewing', null, null
  )$$,
  '42501', 'Admin access required',
  'ordinary users cannot mutate a managed listing request'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"83000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);

select extensions.lives_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'start_review', null
  )$$,
  'admin can start a submitted business application review'
);
select extensions.is(
  (select count(*)::bigint
   from public.admin_list_business_applications('reviewing', 25, null)
   where application_id = '83000000-0000-4000-8000-000000000101'),
  1::bigint,
  'application review state is visible through the protected admin projection'
);
select extensions.throws_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'start_review', null
  )$$,
  '22023', 'Invalid business application state transition',
  'direct callers cannot repeat an unavailable application transition'
);
select extensions.lives_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'request_information',
    'Please provide the registration certificate.'
  )$$,
  'admin can request more information while an application is under review'
);
select extensions.throws_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'reject', null
  )$$,
  '22023', 'A reviewer message is required',
  'application rejection requires an auditable reviewer message'
);
select extensions.lives_ok(
  $$select public.admin_review_business_application(
    '83000000-0000-4000-8000-000000000101', 'reject', 'Evidence was not supplied.'
  )$$,
  'admin can reject a needs-information application with a reason'
);
select extensions.is(
  (select count(*)::bigint
   from public.admin_list_business_applications('rejected', 25, null)
   where application_id = '83000000-0000-4000-8000-000000000101'),
  1::bigint,
  'rejected application state is visible through the protected admin projection'
);

select extensions.lives_ok(
  $$select public.admin_review_business_category(
    '83000000-0000-4000-8000-000000000201', 'approve', null
  )$$,
  'admin can approve a pending business category'
);
select extensions.lives_ok(
  $$select public.admin_review_business_category(
    '83000000-0000-4000-8000-000000000201', 'suspend', 'Paused pending evidence.'
  )$$,
  'admin can suspend an approved business category with a reason'
);
select extensions.lives_ok(
  $$select public.admin_review_business_category(
    '83000000-0000-4000-8000-000000000201', 'approve', null
  )$$,
  'admin can reinstate a suspended business category'
);
select extensions.throws_ok(
  $$select public.admin_review_business_category(
    '83000000-0000-4000-8000-000000000201', 'reject', 'Invalid rejection from approved state.'
  )$$,
  '22023', 'Invalid business category state transition',
  'direct callers cannot reject an approved category without a valid state'
);

select extensions.lives_ok(
  $$select public.admin_update_managed_listing_request(
    '83000000-0000-4000-8000-000000000301', 'reviewing', null, null
  )$$,
  'admin can move a submitted managed request into review'
);
select extensions.throws_ok(
  $$select public.admin_update_managed_listing_request(
    '83000000-0000-4000-8000-000000000301', 'cancelled', null, null
  )$$,
  '22023', 'A reviewer message is required',
  'managed-request cancellation requires an auditable reviewer message'
);
select extensions.lives_ok(
  $$select public.admin_update_managed_listing_request(
    '83000000-0000-4000-8000-000000000301', 'cancelled', 'Owner withdrew the request.', null
  )$$,
  'admin can cancel a managed request with a reason'
);
select extensions.throws_ok(
  $$select public.admin_update_managed_listing_request(
    '83000000-0000-4000-8000-000000000301', 'reviewing', null, null
  )$$,
  '22023', 'Invalid managed listing state transition',
  'terminal managed requests cannot be reopened through the RPC'
);

select extensions.is(
  (select count(*)::bigint
   from public.admin_audit_rows_page('', 'business_application', 100, null, null)
   where target_record_id = '83000000-0000-4000-8000-000000000101'
     and result = 'success'),
  3::bigint,
  'business application decisions are present in the common admin audit stream'
);
select extensions.is(
  (select count(*)::bigint
   from public.admin_audit_rows_page('', 'business_category', 100, null, null)
   where target_record_id = '83000000-0000-4000-8000-000000000201'
     and result = 'success'),
  3::bigint,
  'business category decisions are present in the common admin audit stream'
);
select extensions.is(
  (select count(*)::bigint
   from public.admin_audit_rows_page('', 'managed_listing_request', 100, null, null)
   where target_record_id = '83000000-0000-4000-8000-000000000301'
     and result = 'success'),
  2::bigint,
  'managed listing decisions are present in the common admin audit stream'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.admin_update_managed_listing_request(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'the public managed-listing wrapper remains callable for the authenticated admin boundary'
);

select * from extensions.finish();
rollback;
