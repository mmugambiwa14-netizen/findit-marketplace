begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('73000000-0000-4000-8000-000000000001', 'related-service-seller@example.test', '{"full_name":"Related Listing Seller"}', now(), now()),
  ('73000000-0000-4000-8000-000000000002', 'related-service-provider@example.test', '{"full_name":"Related Service Provider"}', now(), now()),
  ('73000000-0000-4000-8000-000000000003', 'related-service-viewer@example.test', '{"full_name":"Related Service Viewer"}', now(), now());

insert into public.locations (id, name, type, country_code, is_active)
values (
  '73000000-0000-4000-8000-000000000101',
  'Related Service Test City',
  'city',
  'ZW',
  true
);

-- The listing and the service are both fixture setup, but each must still cross
-- its authoritative curated publisher boundary exactly as runtime does. The
-- listing trigger matches on kind ('car'); the service trigger requires a
-- 'service' approval for the provider. They are different users, so each insert
-- gets its own fixture-auth window, cleared immediately after.
insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
)
values
  (
    '73000000-0000-4000-8000-000000000401',
    '73000000-0000-4000-8000-000000000001',
    'Related Listing Motors',
    'Related Listing Seller',
    'related-service-seller@example.test',
    '+263700000401',
    'ZW',
    'Related Service Test City',
    'Approved fixture business used only to certify related-service boundaries.',
    '1-10',
    'approved'
  ),
  (
    '73000000-0000-4000-8000-000000000403',
    '73000000-0000-4000-8000-000000000002',
    'Related Service Providers',
    'Related Service Provider',
    'related-service-provider@example.test',
    '+263700000403',
    'ZW',
    'Related Service Test City',
    'Approved fixture service business used only to certify related-service boundaries.',
    '1-10',
    'approved'
  );

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
)
values
  (
    '73000000-0000-4000-8000-000000000402',
    '73000000-0000-4000-8000-000000000401',
    '73000000-0000-4000-8000-000000000001',
    'car',
    'approved'
  ),
  (
    '73000000-0000-4000-8000-000000000404',
    '73000000-0000-4000-8000-000000000403',
    '73000000-0000-4000-8000-000000000002',
    'service',
    'approved'
  );

select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified
)
values (
  '73000000-0000-4000-8000-000000000201',
  'car',
  '73000000-0000-4000-8000-000000000001',
  'Related Listing Seller',
  'Vehicle needing an inspection service',
  'A complete public vehicle used to verify that related services come from the actual services marketplace.',
  21000,
  'USD',
  21000,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '73000000-0000-4000-8000-000000000101',
  'ZW',
  'cars_sale',
  'sale',
  'available',
  true
);

insert into public.car_details (
  listing_id, brand, model, year, mileage, fuel_type, transmission, condition
)
values (
  '73000000-0000-4000-8000-000000000201',
  'Toyota',
  'Corolla',
  2022,
  22000,
  'petrol',
  'automatic',
  'used'
);

-- Switch fixture auth to the service provider for the services insert, which
-- crosses enforce_curated_service_publisher rather than the listing trigger.
select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.services (
  id,
  provider_id,
  provider_name,
  title,
  description,
  category,
  subcategory,
  subcategories,
  price,
  currency,
  pricing_type,
  location_id,
  location_name,
  status,
  verified
)
values
  (
    '73000000-0000-4000-8000-000000000301',
    '73000000-0000-4000-8000-000000000002',
    'Related Service Provider',
    'Independent vehicle inspection',
    'A public inspection service matched through the vehicle recommendation taxonomy.',
    'mechanic',
    'vehicle-inspection',
    '["vehicle-inspection"]'::jsonb,
    75,
    'USD',
    'fixed',
    '73000000-0000-4000-8000-000000000101',
    'Related Service Test City',
    'active',
    true
  ),
  (
    '73000000-0000-4000-8000-000000000302',
    '73000000-0000-4000-8000-000000000002',
    'Related Service Provider',
    'Paused vehicle repair',
    'A paused service must never become a recommendation.',
    'mechanic',
    'vehicle-repair',
    '["vehicle-repair"]'::jsonb,
    95,
    'USD',
    'fixed',
    '73000000-0000-4000-8000-000000000101',
    'Related Service Test City',
    'paused',
    false
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

set local role service_role;
select extensions.is(
  (select succeeded_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  1,
  'worker projects the related-service subject listing'
);
-- 0100_release_control_consistency.sql is the reviewed activation point, so the
-- related-services service now answers instead of refusing. A live answer sets
-- degraded false; only a disabled service or a timeout degrades.
select extensions.is(
  (public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->>'degraded')::boolean,
  false,
  'the activated related-services service answers instead of degrading'
);
reset role;

-- Keep proving the disabled path rather than losing it with the stale
-- expectation. The toggle is transaction-local and reverted immediately; the
-- runtime service role deliberately cannot perform it.
update public.recommendation_service_policies
set enabled = false
where service_name = 'related_services_service';

set local role service_role;
select extensions.is(
  public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->>'reason',
  'service_disabled',
  'a disabled related-services service still degrades before any matching'
);
reset role;

update public.recommendation_service_policies
set enabled = true
where service_name = 'related_services_service';

update public.recommendation_service_policies
set enabled = true
where service_name = 'related_services_service';

set local role service_role;
select extensions.is(
  public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->>'degraded',
  'false',
  'enabled related services returns a healthy response'
);
select extensions.is(
  public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->'items'->0->>'entityType',
  'service',
  'related services returns a typed service entity'
);
select extensions.is(
  public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->'items'->0->>'serviceId',
  '73000000-0000-4000-8000-000000000301',
  'taxonomy relationship selects the active inspection service'
);
select extensions.is(
  jsonb_array_length(
    public.related_services_service_v1(
      '73000000-0000-4000-8000-000000000201',
      null,
      6
    )->'items'
  ),
  1,
  'paused services are excluded'
);
reset role;

set local role anon;
select extensions.isnt(
  public.record_recommended_service_event_v1(
    'recommendation_impression',
    '73000000-0000-4000-8000-000000000301',
    '73000000-0000-4000-8000-000000000401',
    '73000000-0000-4000-8000-000000000402',
    'related_services_service',
    'category_related_service',
    '{"surface":"listing_detail","source":"listing:related-service","position":0,"page_size":1,"result_count":1}'::jsonb
  ),
  null::uuid,
  'anonymous browser records aggregate-safe service impression attribution'
);
select extensions.throws_ok(
  $$select public.record_recommended_service_event_v1(
    'recommendation_click',
    '73000000-0000-4000-8000-000000000302',
    '73000000-0000-4000-8000-000000000401',
    '73000000-0000-4000-8000-000000000402',
    'related_services_service',
    'category_related_service',
    '{"surface":"listing_detail","source":"listing:related-service","position":0,"page_size":1,"result_count":1}'::jsonb
  )$$,
  '22023',
  'service is not publicly available',
  'service event attribution rejects a paused target'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_events$$,
  '.*permission denied for table recommendation_events.*',
  'browser cannot read raw service recommendation events'
);
reset role;

select extensions.is(
  (select count(*)::bigint
   from public.recommendation_events
   where recommendation_service = 'related-services-service'
     and event_type = 'recommendation_impression'
     and listing_id is null
     and seller_id = '73000000-0000-4000-8000-000000000002'),
  1::bigint,
  'service impression stores only aggregate attribution and provider ownership'
);
select extensions.ok(
  has_function_privilege(
    'anon',
    'public.record_recommended_service_event_v1(text,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous browser has only the bounded service event RPC'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.related_services_service_v1(uuid,text,integer)',
    'EXECUTE'
  ),
  'browser cannot bypass the related-services Edge transport'
);
select extensions.throws_ok(
  $$insert into public.recommendation_events (
    id,
    occurred_at,
    anonymous_session_id,
    event_type,
    seller_id,
    recommendation_request_id,
    recommendation_service,
    reason_code,
    context,
    expires_at
  ) values (
    gen_random_uuid(),
    now(),
    gen_random_uuid(),
    'recommendation_impression',
    '73000000-0000-4000-8000-000000000002',
    gen_random_uuid(),
    'similar-listings-service',
    'INVALID_SERVICE_SUBJECT',
    '{"surface":"listing_detail","source":"constraint-test","position":0,"page_size":1,"result_count":1}'::jsonb,
    now() + interval '30 days'
  )$$,
  '22023',
  'event subject is not publicly eligible',
  'listing recommendation services cannot write provider-only subjects'
);

select * from extensions.finish();
rollback;
