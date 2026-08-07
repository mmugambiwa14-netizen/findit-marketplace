begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003001', 'notification-admin@example.test', '{"full_name":"Notification Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000003002', 'notification-owner@example.test', '{"full_name":"Notification Owner"}', now(), now()),
  ('00000000-0000-4000-8000-000000003003', 'notification-reporter@example.test', '{"full_name":"Notification Reporter"}', now(), now()),
  ('00000000-0000-4000-8000-000000003004', 'notification-stranger@example.test', '{"full_name":"Notification Stranger"}', now(), now());

update public.users set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-000000003001';

-- Current MVP has no human listing approval/rejection step. Authorize the
-- seller through the curated business/category boundary, then create the
-- listing through the same private-media + authenticated submission path used
-- by the product. Authenticated clients intentionally have no direct INSERT
-- privilege on public.listings.
insert into public.business_applications (
  id,
  user_id,
  business_name,
  contact_name,
  business_email,
  business_phone,
  country_code,
  city,
  description,
  expected_inventory_band,
  status
)
values (
  '00000000-0000-4000-8000-000000003301',
  '00000000-0000-4000-8000-000000003002',
  'Notification Test Motors',
  'Notification Owner',
  'notification-owner@example.test',
  '+263700003002',
  'ZW',
  'Harare',
  'Approved fixture business used only to certify operational notifications.',
  '1-10',
  'approved'
);

insert into public.business_category_approvals (
  id,
  business_application_id,
  user_id,
  category,
  status
)
values (
  '00000000-0000-4000-8000-000000003302',
  '00000000-0000-4000-8000-000000003301',
  '00000000-0000-4000-8000-000000003002',
  'car',
  'approved'
);

create temporary table notification_listing_fixture (
  intent_id uuid,
  storage_path text,
  listing_id uuid
) on commit drop;

grant select, insert, update on notification_listing_fixture to service_role, authenticated;

set local role service_role;
insert into notification_listing_fixture(intent_id, storage_path)
select
  public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000003002',
    '00000000-0000-4000-8000-000000003002/staging/00000000-0000-4000-8000-000000003401.png',
    'image/png', 68, 1, 1, repeat('b', 64)
  ),
  '00000000-0000-4000-8000-000000003002/staging/00000000-0000-4000-8000-000000003401.png';
reset role;

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000003402',
  'listing-images',
  '00000000-0000-4000-8000-000000003002/staging/00000000-0000-4000-8000-000000003401.png',
  '00000000-0000-4000-8000-000000003002',
  '00000000-0000-4000-8000-000000003002',
  '{"mimetype":"image/png","size":68}'::jsonb
);

set local role service_role;
select extensions.lives_ok(
  $$select public.complete_listing_image_upload((select intent_id from notification_listing_fixture))$$,
  'trusted upload completion accepts the validated notification fixture image'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000003403',
    '{"kind":"car","title":"2022 Toyota Fortuner notification vehicle","description":"A complete approved seller vehicle listing created through the real publication path for notification certification.","category":"cars_sale","listingType":"sale","price":14000,"currency":"USD","negotiable":false,"locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263700003002"}'::jsonb,
    '{"brand":"Toyota","model":"Fortuner","year":"2022","mileage":"32000","fuelType":"diesel","transmission":"automatic","condition":"used"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from notification_listing_fixture),
      'path', (select storage_path from notification_listing_fixture)
    ))
  )$$,
  'an approved authenticated seller creates the notification fixture through the live listing submission RPC'
);
reset role;

update notification_listing_fixture
set listing_id = (
  select id from public.listings
  where submission_key = '00000000-0000-4000-8000-000000003403'
);

select extensions.is(
  (select status::text from public.listings where id = (select listing_id from notification_listing_fixture)),
  'available',
  'validated approved-category listing auto-publishes without human listing review'
);
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003002'
     and event_type in ('listing_approved', 'listing_rejected')),
  0::bigint,
  'the current MVP listing publication path emits no human approval or rejection notification'
);
select extensions.ok(
  (select expires_at is not null from public.listings
   where id = (select listing_id from notification_listing_fixture)),
  'automatic publication still assigns a server-managed listing expiry'
);

-- Owner lifecycle transitions are current marketplace behavior and create the
-- owner-facing listing_status_changed notification when availability ends.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select extensions.lives_ok(
  $$select public.owner_transition_listing(
    (select listing_id from notification_listing_fixture), 'unavailable'
  )$$,
  'the owner can move a live listing to unavailable through the trusted lifecycle RPC'
);

reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003002'
     and event_type = 'listing_status_changed'),
  1::bigint,
  'owner unavailability creates one current listing-status notification'
);

-- Restore the fixture under trusted SQL setup, then place it two days from
-- expiry. The second update keeps old/new status available so the expiry-default
-- trigger does not replace the explicit due-soon timestamp.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.listings
set status = 'available'
where id = (select listing_id from notification_listing_fixture);
update public.listings
set expires_at = now() + interval '2 days', expiry_notice_sent_at = null
where id = (select listing_id from notification_listing_fixture);

select extensions.is(
  public.process_listing_expiry_notifications(now()) ->> 'notices_created',
  '1',
  'the service-only expiry worker creates a due-soon notice'
);
select extensions.is(
  public.process_listing_expiry_notifications(now()) ->> 'notices_created',
  '0',
  'the expiry worker is idempotent for an already-notified listing'
);

insert into public.reports (
  id, listing_id, listing_type, listing_title, reason, reporter_id
) values (
  '00000000-0000-4000-8000-000000003201',
  (select listing_id from notification_listing_fixture), 'vehicle',
  '2022 Toyota Fortuner notification vehicle', 'fake',
  '00000000-0000-4000-8000-000000003003'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select extensions.lives_ok(
  $$select public.admin_review_report(
    '00000000-0000-4000-8000-000000003201', 'dismissed',
    'Review completed; the advert is legitimate'
  )$$,
  'a final report decision is recorded atomically'
);
select extensions.lives_ok(
  $$select public.admin_set_user_status(
    '00000000-0000-4000-8000-000000003002', 'suspended',
    'Temporary safety review', null
  )$$,
  'account suspension creates a trusted account event'
);
select extensions.lives_ok(
  $$select public.admin_set_user_status(
    '00000000-0000-4000-8000-000000003002', 'active',
    'Safety review complete', null
  )$$,
  'account restoration creates a trusted account event'
);

reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003003'
     and event_type = 'report_resolved'),
  1::bigint,
  'a final report decision notifies the reporter once'
);
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003002'
     and event_type = 'account_status'),
  2::bigint,
  'suspension and restoration share one bounded account-status class'
);
select extensions.ok(public.is_safe_notification_link('/my-listings'), 'approved internal notification links are accepted');
select extensions.ok(not public.is_safe_notification_link('https://unsafe.example'), 'external notification links are rejected');
select extensions.throws_ok(
  $$select public.create_essential_notification(
    '00000000-0000-4000-8000-000000003002', 'price_drop', 'unsafe-source',
    'Price drop', 'Marketing message', 'https://unsafe.example', null
  )$$,
  '22023', 'unsupported notification event',
  'marketing events cannot enter the trusted V1 notification contract'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.notification_rows('all', false, 50, 0)),
  4::bigint,
  'an owner sees only the four current trusted fixture notifications'
);
select extensions.is(public.notification_unread_count(), 4::bigint, 'unread count is calculated at the server boundary');
select extensions.ok(
  public.mark_notification_read((select notification_id from public.notification_rows('listing_status_changed', false, 1, 0))),
  'an owner can mark the current listing-status notification read through the trusted RPC'
);
select extensions.is(public.mark_all_notifications_read(), 3, 'an owner can mark all remaining notifications read');
select extensions.is(public.notification_unread_count(), 0::bigint, 'read-state changes update the unread count');
select extensions.throws_ok(
  $$insert into public.app_alerts (
    user_id, title, message, type, event_type, source_key
  ) values (
    '00000000-0000-4000-8000-000000003002', 'Fake', 'Fake',
    'system', 'account_status', 'client-forgery'
  )$$,
  '42501', 'permission denied for table app_alerts',
  'authenticated clients cannot forge notifications'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003004","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.notification_rows('all', false, 50, 0)),
  0::bigint,
  'another active user cannot read someone else notifications'
);

select * from extensions.finish();
rollback;
