begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'curated-approved@example.test', '{"full_name":"Approved Publisher"}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'curated-unapproved@example.test', '{"full_name":"Unapproved Publisher"}', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'curated-admin@example.test', '{"full_name":"Curated Admin"}', now(), now());

update public.users set role = 'admin' where id = '41000000-0000-4000-8000-000000000003';

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '41000000-0000-4000-8000-000000000101',
  '41000000-0000-4000-8000-000000000001',
  'Approved Cars Test', 'Approved Publisher', 'curated-approved@example.test', '+263700000001',
  'ZW', 'Harare', 'A complete test business used for curated marketplace publication certification.', '1-10', 'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values
  ('41000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'car', 'approved'),
  ('41000000-0000-4000-8000-000000000202', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'property', 'pending');

select extensions.ok(
  not has_function_privilege('anon', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'anonymous users cannot invoke business application submission'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'authenticated users can invoke business application submission'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.admin_review_business_application(uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot invoke admin review RPCs'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'private.notify_business_category_change()', 'EXECUTE'),
  'notification trigger function is not directly executable by browser users'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.ok(public.can_publish_in_category('car'), 'approved Cars publisher passes the category gate');
select extensions.ok(not public.can_publish_in_category('property'), 'pending Property category does not pass the gate');
select extensions.ok(not public.can_publish_in_category('service'), 'unrequested Services category does not pass the gate');
reset role;

update public.business_category_approvals
set status = 'suspended', reviewer_message = 'Certification suspension', updated_at = clock_timestamp()
where id = '41000000-0000-4000-8000-000000000201';

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.ok(not public.can_publish_in_category('car'), 'suspended category immediately loses publishing access');
reset role;

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '41000000-0000-4000-8000-000000000001'
     and event_type = 'business_category_updated'
     and link = '/post'),
  1::bigint,
  'category status change creates one in-app notification'
);

insert into public.managed_listing_requests (
  id, requester_user_id, category, owner_name, contact_email, contact_phone,
  country_code, city, item_summary, status
) values (
  '41000000-0000-4000-8000-000000000301',
  '41000000-0000-4000-8000-000000000002',
  'machinery', 'Managed Owner', 'managed@example.test', '+263700000002',
  'ZW', 'Harare', 'A managed excavator listing request used to certify operational notifications.', 'submitted'
);

update public.managed_listing_requests
set status = 'needs_information', reviewer_message = 'Please provide the machine serial number.', updated_at = clock_timestamp()
where id = '41000000-0000-4000-8000-000000000301';

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '41000000-0000-4000-8000-000000000002'
     and event_type = 'managed_listing_updated'
     and link = '/post'),
  1::bigint,
  'managed listing status change creates one in-app notification'
);

select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'listings'
      and trigger_name = 'listings_enforce_curated_publisher'
  ),
  'authoritative listing publication trigger exists'
);
select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'services'
      and trigger_name = 'services_enforce_curated_publisher'
  ),
  'authoritative service publication trigger exists'
);

select * from extensions.finish();
rollback;
