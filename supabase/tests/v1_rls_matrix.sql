begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001001', 'v1-owner@example.test', '{"full_name":"V1 Owner"}', now(), now()),
  ('00000000-0000-4000-8000-000000001002', 'v1-buyer@example.test', '{"full_name":"V1 Buyer"}', now(), now()),
  ('00000000-0000-4000-8000-000000001003', 'v1-stranger@example.test', '{"full_name":"V1 Stranger"}', now(), now()),
  ('00000000-0000-4000-8000-000000001004', 'v1-suspended@example.test', '{"full_name":"V1 Suspended"}', now(), now()),
  ('00000000-0000-4000-8000-000000001005', 'v1-admin@example.test', '{"full_name":"V1 Admin"}', now(), now());

update public.users set status = 'suspended', role = 'admin'
where id = '00000000-0000-4000-8000-000000001004';
update public.users set role = 'admin'
where id = '00000000-0000-4000-8000-000000001005';

insert into public.locations (id, name, type, country_code, is_active)
values
  ('00000000-0000-4000-8000-000000001101', 'Harare', 'city', 'ZW', true),
  ('00000000-0000-4000-8000-000000001102', 'Retired Area', 'city', 'ZW', false);

insert into public.listings (
  id, kind, seller_id, seller_name, title, price, status, location_id
)
values
  (
    '00000000-0000-4000-8000-000000001201',
    'car',
    '00000000-0000-4000-8000-000000001001',
    'V1 Owner',
    'Public Hilux',
    25000,
    'available',
    '00000000-0000-4000-8000-000000001101'
  ),
  (
    '00000000-0000-4000-8000-000000001202',
    'car',
    '00000000-0000-4000-8000-000000001001',
    'V1 Owner',
    'Private Draft',
    10000,
    'draft',
    '00000000-0000-4000-8000-000000001101'
  );

insert into public.car_details (listing_id, brand, model, year, mileage)
values
  ('00000000-0000-4000-8000-000000001201', 'Toyota', 'Hilux', 2022, 30000),
  ('00000000-0000-4000-8000-000000001202', 'Toyota', 'Corolla', 2020, 45000);

insert into public.services (
  id, provider_id, provider_name, title, category, status
)
values
  (
    '00000000-0000-4000-8000-000000001301',
    '00000000-0000-4000-8000-000000001001',
    'V1 Owner',
    'Mobile mechanic',
    'mechanic',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000001302',
    '00000000-0000-4000-8000-000000001001',
    'V1 Owner',
    'Paused inspection service',
    'mechanic',
    'paused'
  );

insert into public.business_profiles (
  id, user_id, company_name, business_type, registration_number, phone, verified
)
values (
  '00000000-0000-4000-8000-000000001401',
  '00000000-0000-4000-8000-000000001001',
  'V1 Motors',
  'car_dealership',
  'PRIVATE-REGISTRATION',
  '+263771234567',
  false
);

insert into public.app_alerts (
  id, user_id, title, message, type, listing_id, event_type, source_key
)
values (
  '00000000-0000-4000-8000-000000001501',
  '00000000-0000-4000-8000-000000001002',
  'Listing approved',
  'Your listing is now visible.',
  'status_change',
  '00000000-0000-4000-8000-000000001201',
  'listing_approved',
  'v1-rls-fixture'
);

set local role anon;

select extensions.is(
  (select count(*)::bigint from public.listings),
  1::bigint,
  'anonymous users see only public listing states'
);
select extensions.is(
  (select count(*)::bigint from public.locations where id = '00000000-0000-4000-8000-000000001101'),
  1::bigint,
  'anonymous users can read the active fixture location'
);
select extensions.is(
  (select count(*)::bigint from public.locations where id = '00000000-0000-4000-8000-000000001102'),
  0::bigint,
  'anonymous users cannot read inactive locations'
);
select extensions.is(
  (select count(*)::bigint from public.business_profiles_public),
  1::bigint,
  'anonymous users can read the explicit public business projection'
);
select extensions.is(
  public.get_public_seller_profile('V1-OWNER@EXAMPLE.TEST') ->> 'full_name',
  'V1 Owner'::text,
  'anonymous users can resolve the bounded active seller summary case-insensitively'
);
select extensions.is(
  public.get_public_seller_profile('v1-suspended@example.test'),
  null::jsonb,
  'suspended accounts have no public seller summary'
);
select extensions.is(
  public.get_public_seller_profile('v1-owner@example.test')
    ?| array['email', 'phone', 'role', 'status', 'verified'],
  false,
  'public seller summary excludes private and verification fields'
);
select extensions.throws_ok(
  $$select count(*) from public.business_profiles$$,
  '42501',
  'permission denied for table business_profiles',
  'anonymous users cannot read the private business table'
);
select extensions.throws_ok(
  $$select count(*) from public.legal_practitioners$$,
  '42501',
  'permission denied for table legal_practitioners',
  'deferred legal profiles have no anonymous table contract'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001001', true);
set local role authenticated;

select extensions.is(public.is_active_user(), true, 'active owner passes active-account predicate');
select extensions.is(public.is_admin(), false, 'ordinary owner is not an admin');
select extensions.is(
  (select count(*)::bigint from public.listings),
  2::bigint,
  'owner sees public and own draft listings'
);
select extensions.lives_ok(
  $$update public.listings
    set title = 'Owner Updated Title'
    where id = '00000000-0000-4000-8000-000000001202'$$,
  'owner can update an ordinary listing field'
);
select extensions.throws_ok(
  $$update public.listings
    set verified = true
    where id = '00000000-0000-4000-8000-000000001202'$$,
  '42501',
  'listing-managed fields require a trusted operation',
  'owner cannot set a server-managed listing field'
);
select extensions.throws_matching(
  $$insert into public.listings (kind, seller_id, title, price)
    values ('car', '00000000-0000-4000-8000-000000001001', 'Negative Price', -1)$$,
  '.*permission denied for table listings.*',
  'new listings must use the trusted V1 submission operation'
);
select extensions.throws_ok(
  $$update public.services
    set verified = true
    where id = '00000000-0000-4000-8000-000000001301'$$,
  '42501',
  'service-managed fields require a trusted operation',
  'service owner cannot set server-managed verification'
);
select extensions.lives_ok(
  $$delete from public.services
    where id = '00000000-0000-4000-8000-000000001302'$$,
  'active service owner delete completes'
);
select extensions.is(
  (select count(*)::bigint from public.services
   where id = '00000000-0000-4000-8000-000000001302'),
  0::bigint,
  'active service owner delete removes the owned service'
);
select extensions.is(
  (select count(*)::bigint from public.business_profiles),
  1::bigint,
  'business owner can read the private owner row'
);
select extensions.throws_ok(
  $$update public.business_profiles
    set verified = true
    where id = '00000000-0000-4000-8000-000000001401'$$,
  '42501',
  'business-profile managed fields require a trusted operation',
  'business owner cannot self-verify'
);
select extensions.throws_ok(
  $$select public.write_audit_log('not.allowed')$$,
  '42501',
  'admin access required',
  'ordinary user cannot write an audit record'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001002', true);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.listings),
  1::bigint,
  'unrelated active user cannot see another seller draft'
);
select extensions.lives_ok(
  $$insert into public.saved_listings (user_id, listing_id)
    values (
      '00000000-0000-4000-8000-000000001002',
      '00000000-0000-4000-8000-000000001201'
    )$$,
  'active user may save a public listing'
);
select extensions.throws_ok(
  $$insert into public.saved_listings (user_id, listing_id)
    values (
      '00000000-0000-4000-8000-000000001002',
      '00000000-0000-4000-8000-000000001202'
    )$$,
  '42501',
  'new row violates row-level security policy for table "saved_listings"',
  'user cannot save another seller draft'
);
select extensions.is(
  (select count(*)::bigint from public.saved_listings),
  1::bigint,
  'user sees only their own Favourites'
);
select extensions.lives_ok(
  $$select public.start_listing_conversation(
      '00000000-0000-4000-8000-000000001201',
      'Is this available?'
    )$$,
  'buyer can start a listing-linked plain-text conversation'
);
select extensions.throws_ok(
  $$insert into public.inquiries (
      listing_id, seller_id, buyer_id, sender_id, conversation_id, message
    ) values (
      '00000000-0000-4000-8000-000000001201',
      '00000000-0000-4000-8000-000000001003',
      '00000000-0000-4000-8000-000000001002',
      '00000000-0000-4000-8000-000000001002',
      gen_random_uuid(),
      'Spoofed seller'
    )$$,
  '42501',
  'new row violates row-level security policy for table "inquiries"',
  'buyer cannot spoof the listing seller'
);
select extensions.is(
  (select count(*)::bigint from public.app_alerts),
  1::bigint,
  'notification owner can read their essential notification'
);
select extensions.lives_ok(
  $$select public.mark_notification_read(
    '00000000-0000-4000-8000-000000001501'
  )$$,
  'notification owner can use the trusted read-state operation'
);
select extensions.throws_ok(
  $$update public.app_alerts
    set title = 'Tampered title'
    where id = '00000000-0000-4000-8000-000000001501'$$,
  '42501',
  'permission denied for table app_alerts',
  'notification owner has no direct content mutation privilege'
);
select extensions.lives_ok(
  $$insert into public.reports (
      listing_id, listing_type, reason, reporter_id
    ) values (
      '00000000-0000-4000-8000-000000001201',
      'vehicle',
      'scam',
      '00000000-0000-4000-8000-000000001002'
    )$$,
  'active user can report a public listing'
);
select extensions.throws_ok(
  $$insert into public.reports (
      listing_id, listing_type, reason, reporter_id, status
    ) values (
      '00000000-0000-4000-8000-000000001201',
      'vehicle',
      'scam',
      '00000000-0000-4000-8000-000000001002',
      'actioned'
    )$$,
  '42501',
  'new row violates row-level security policy for table "reports"',
  'reporter cannot submit a pre-resolved report'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001001', true);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.saved_listings),
  0::bigint,
  'another user cannot read the buyer Favourites'
);
select extensions.lives_ok(
  $$select public.send_conversation_message(
      (select id from public.conversations
        where listing_id = '00000000-0000-4000-8000-000000001201'
          and buyer_id = '00000000-0000-4000-8000-000000001002'),
      'Yes, it is available.'
    )$$,
  'seller can reply only to an existing matching conversation'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001003', true);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.inquiries),
  0::bigint,
  'unrelated user cannot read a conversation'
);
select extensions.is(
  (select count(*)::bigint from public.reports),
  0::bigint,
  'unrelated user cannot read another reporter record'
);
select extensions.is(
  (select count(*)::bigint from public.business_profiles),
  0::bigint,
  'unrelated authenticated user cannot read private business data'
);
select extensions.lives_ok(
  $$delete from public.services
    where id = '00000000-0000-4000-8000-000000001301'$$,
  'unrelated service delete is safely filtered by RLS'
);
select extensions.is(
  (select count(*)::bigint from public.services
   where id = '00000000-0000-4000-8000-000000001301'),
  1::bigint,
  'unrelated user cannot delete another provider service'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001004', true);
set local role authenticated;

select extensions.is(public.is_active_user(), false, 'suspended account fails active predicate');
select extensions.is(public.is_admin(), false, 'suspended admin-labelled account fails admin predicate');
select extensions.is(
  (select count(*)::bigint from public.listings),
  1::bigint,
  'suspended account retains only anonymous public visibility'
);
select extensions.throws_ok(
  $$insert into public.saved_listings (user_id, listing_id)
    values (
      '00000000-0000-4000-8000-000000001004',
      '00000000-0000-4000-8000-000000001201'
    )$$,
  '42501',
  'new row violates row-level security policy for table "saved_listings"',
  'suspended account cannot save a listing'
);
select extensions.throws_ok(
  $$select public.create_v1_listing_submission(
      '00000000-0000-4000-8000-000000001904',
      '{}'::jsonb,
      '{}'::jsonb,
      '[]'::jsonb
    )$$,
  '42501',
  'active account required',
  'suspended account cannot submit a listing'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001005', true);
set local role authenticated;

select extensions.is(public.is_admin(), true, 'active admin passes admin predicate');
select extensions.is(
  (select count(*)::bigint from public.listings),
  2::bigint,
  'active admin sees public and draft listings'
);
select extensions.is(
  (select count(*)::bigint from public.reports),
  1::bigint,
  'active admin can read the moderation queue'
);
select extensions.isnt(
  public.write_audit_log('report.review', '00000000-0000-4000-8000-000000001201', 'listing'),
  null::uuid,
  'active admin writes an attributed durable audit row'
);
select extensions.is(
  (select count(*)::bigint from public.audit_logs),
  1::bigint,
  'active admin can read the durable audit row'
);

reset role;

select extensions.is(
  (select count(*)::bigint
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'business_profiles_public'
     and column_name in ('registration_number', 'issuing_body', 'verified', 'verification_status')),
  0::bigint,
  'public business projection excludes verification and registration fields'
);
select extensions.is(
  (select count(*)::bigint
   from pg_constraint
   where connamespace = 'public'::regnamespace
     and conname in (
       'listings_price_nonnegative',
       'listings_views_nonnegative',
       'car_details_mileage_nonnegative',
       'car_details_year_plausible',
       'property_details_counts_nonnegative',
       'property_details_size_positive',
       'machinery_details_usage_nonnegative',
       'machinery_details_year_plausible',
       'services_price_nonnegative',
       'services_views_nonnegative'
     )),
  10::bigint,
  'all V1 numeric integrity constraints exist'
);

select * from extensions.finish();
rollback;
