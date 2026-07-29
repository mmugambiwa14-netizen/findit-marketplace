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
  'sedans',
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

set local role service_role;
select extensions.is(
  (select succeeded_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  1,
  'worker projects the related-service subject listing'
);
select extensions.is(
  public.related_services_service_v1(
    '73000000-0000-4000-8000-000000000201',
    null,
    6
  )->>'reason',
  'service_disabled',
  'related services remains disabled by default'
);
reset role;

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
select extensions.throws_matching(
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
    '{}'::jsonb,
    now() + interval '30 days'
  )$$,
  '.*recommendation_events_subject_boundary.*',
  'listing recommendation services cannot write provider-only subjects'
);

select * from extensions.finish();
rollback;
