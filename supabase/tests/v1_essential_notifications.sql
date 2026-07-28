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

insert into public.listings (id, kind, seller_id, seller_name, title, category, price, status)
values (
  '00000000-0000-4000-8000-000000003101', 'car',
  '00000000-0000-4000-8000-000000003002', 'Notification Owner',
  'Notification vehicle', 'cars_sale', 14000, 'pending_review'
);
insert into public.car_details (listing_id, brand, model)
values ('00000000-0000-4000-8000-000000003101', 'Toyota', 'Fortuner');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.admin_moderate_marketplace_item(
    '00000000-0000-4000-8000-000000003101', 'car', 'publish',
    'Advert meets marketplace requirements'
  )$$,
  'admin approval uses the trusted moderation operation'
);

reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003002'
     and event_type = 'listing_approved'),
  1::bigint,
  'listing approval creates one V1 notification'
);
select extensions.ok(
  (select expires_at is not null from public.listings
   where id = '00000000-0000-4000-8000-000000003101'),
  'publishing assigns a server-managed listing expiry'
);

-- A separate review cycle is established as trusted test setup so this suite
-- can verify the rejection notification without weakening the production
-- state machine (only pending submissions may be rejected).
update public.listings
set status = 'pending_review', submitted_at = now(), moderation_reason = null
where id = '00000000-0000-4000-8000-000000003101';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.admin_moderate_marketplace_item(
    '00000000-0000-4000-8000-000000003101', 'car', 'reject',
    'Contact details require correction'
  )$$,
  'admin can reject a product advert with an owner-visible reason'
);

reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000003002'
     and event_type = 'listing_rejected'),
  1::bigint,
  'listing rejection creates one V1 notification'
);

update public.listings
set status = 'available', expires_at = now() + interval '2 days', expiry_notice_sent_at = null
where id = '00000000-0000-4000-8000-000000003101';

select extensions.is(
  public.process_listing_expiry_notifications(now() + interval '28 days') ->> 'notices_created',
  '1',
  'the service-only expiry worker creates a due notice'
);
select extensions.is(
  public.process_listing_expiry_notifications(now() + interval '28 days') ->> 'notices_created',
  '0',
  'the expiry worker is idempotent for an already-notified listing'
);

insert into public.reports (
  id, listing_id, listing_type, listing_title, reason, reporter_id
) values (
  '00000000-0000-4000-8000-000000003201',
  '00000000-0000-4000-8000-000000003101', 'vehicle',
  'Notification vehicle', 'fake',
  '00000000-0000-4000-8000-000000003003'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
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
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.notification_rows('all', false, 50, 0)),
  5::bigint,
  'an owner sees only their five trusted fixture notifications'
);
select extensions.is(public.notification_unread_count(), 5::bigint, 'unread count is calculated at the server boundary');
select extensions.ok(
  public.mark_notification_read((select notification_id from public.notification_rows('listing_approved', false, 1, 0))),
  'an owner can mark one notification read through the trusted RPC'
);
select extensions.is(public.mark_all_notifications_read(), 4, 'an owner can mark all remaining notifications read');
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
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.notification_rows('all', false, 50, 0)),
  0::bigint,
  'another active user cannot read someone else notifications'
);

select * from extensions.finish();
rollback;
