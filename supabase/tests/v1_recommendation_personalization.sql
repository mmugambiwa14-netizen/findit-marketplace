begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-4000-8000-000000000001', 'personalization-viewer@example.test', '{"full_name":"Personalization Viewer"}', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'personalization-other@example.test', '{"full_name":"Personalization Other"}', now(), now()),
  ('71000000-0000-4000-8000-000000000003', 'personalization-seller@example.test', '{"full_name":"Personalization Seller"}', now(), now());

insert into public.locations (id, name, type, country_code, latitude, longitude, is_active)
values (
  '71000000-0000-4000-8000-000000000101',
  'Personalization Test City',
  'city',
  'ZW',
  -17.8252,
  31.0335,
  true
);

-- These controlled public listings are fixture setup, but they must still cross
-- the authoritative curated publisher boundary exactly as runtime does.
-- enforce_curated_listing_publisher() matches on the listing's kind, so this
-- seller needs approvals for both 'car' and 'property'. Fixture auth is opened
-- only for the inserts and cleared before any assertion runs.
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
  '71000000-0000-4000-8000-000000000401',
  '71000000-0000-4000-8000-000000000003',
  'Personalization Test Traders',
  'Personalization Seller',
  'personalization-seller@example.test',
  '+263700000401',
  'ZW',
  'Personalization Test City',
  'Approved fixture business used only to certify personalization boundaries.',
  '1-10',
  'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
)
values
  (
    '71000000-0000-4000-8000-000000000402',
    '71000000-0000-4000-8000-000000000401',
    '71000000-0000-4000-8000-000000000003',
    'car',
    'approved'
  ),
  (
    '71000000-0000-4000-8000-000000000403',
    '71000000-0000-4000-8000-000000000401',
    '71000000-0000-4000-8000-000000000003',
    'property',
    'approved'
  );

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified
)
values
  (
    '71000000-0000-4000-8000-000000000201',
    'car',
    '71000000-0000-4000-8000-000000000003',
    'Personalization Seller',
    'Post-consent vehicle',
    'A complete public vehicle used to verify that post-consent first-party activity can produce bounded personalized recommendations.',
    24000,
    'USD',
    24000,
    'USD',
    '[{"path":"one"},{"path":"two"}]'::jsonb,
    '71000000-0000-4000-8000-000000000101',
    'ZW',
    'utility',
    'sale',
    'available',
    true
  ),
  (
    '71000000-0000-4000-8000-000000000202',
    'property',
    '71000000-0000-4000-8000-000000000003',
    'Personalization Seller',
    'Pre-consent property',
    'A complete public property used to prove that activity recorded before consent never enters personalized ranking.',
    120000,
    'USD',
    120000,
    'USD',
    '[{"path":"one"},{"path":"two"}]'::jsonb,
    '71000000-0000-4000-8000-000000000101',
    'ZW',
    'house_sale',
    'sale',
    'available',
    true
  );

insert into public.car_details (
  listing_id, brand, model, year, mileage, fuel_type, transmission, condition
)
values (
  '71000000-0000-4000-8000-000000000201',
  'Toyota',
  'Hilux',
  2023,
  18000,
  'diesel',
  'automatic',
  'used'
);

insert into public.property_details (
  listing_id, property_type, bedrooms, bathrooms, size_sqm
)
values (
  '71000000-0000-4000-8000-000000000202',
  'house',
  3,
  2,
  140
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

set local role service_role;
select extensions.is(
  (select succeeded_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  2,
  'worker projects both eligible personalization fixtures'
);
reset role;

select extensions.has_table(
  'public',
  'recommendation_personalization_preferences',
  'personalization preference table exists'
);
select extensions.has_function(
  'public',
  'get_my_recommendation_personalization_v1',
  array[]::text[],
  'owner preference read contract exists'
);
select extensions.has_function(
  'public',
  'set_my_recommendation_personalization_v1',
  array['boolean'],
  'owner preference write contract exists'
);
select extensions.has_function(
  'public',
  'clear_my_recommendation_personalization_data_v1',
  array[]::text[],
  'owner data-clear contract exists'
);

set local role anon;
select extensions.throws_matching(
  $$select public.get_my_recommendation_personalization_v1()$$,
  '.*permission denied for function get_my_recommendation_personalization_v1.*',
  'anonymous callers cannot inspect personalization preferences'
);
reset role;

insert into public.recommendation_events (
  occurred_at,
  actor_id,
  event_type,
  listing_id,
  seller_id,
  context,
  expires_at
)
values (
  now() - interval '1 day',
  '71000000-0000-4000-8000-000000000001',
  'view',
  '71000000-0000-4000-8000-000000000202',
  '71000000-0000-4000-8000-000000000003',
  '{"surface":"listing_detail"}'::jsonb,
  now() + interval '179 days'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.is(
  (public.get_my_recommendation_personalization_v1()->>'enabled')::boolean,
  false,
  'personalization is off when no owner preference exists'
);
select extensions.is(
  (public.set_my_recommendation_personalization_v1(true)->>'enabled')::boolean,
  true,
  'active owner explicitly enables personalization'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_personalization_preferences),
  1::bigint,
  'owner RLS exposes only the caller preference'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'save',
    p_listing_id => '71000000-0000-4000-8000-000000000201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  ),
  null::uuid,
  'post-consent first-party activity is recorded'
);
reset role;

insert into public.recommendation_personalization_preferences (
  user_id, enabled, consent_version, enabled_at
)
values (
  '71000000-0000-4000-8000-000000000002',
  true,
  1,
  now()
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.recommendation_personalization_preferences),
  1::bigint,
  'owner cannot read another account preference'
);
reset role;

update public.recommendation_service_policies
set enabled = true
where service_name = 'personalized_recommendation_service';

set local role service_role;
select extensions.is(
  public.personalized_recommendation_service_v1(
    '71000000-0000-4000-8000-000000000001',
    null,
    12
  )->>'degraded',
  'false',
  'enabled personalization returns a healthy independent response'
);
select extensions.is(
  (
    select item->>'categoryKey'
    from jsonb_array_elements(
      public.personalized_recommendation_service_v1(
        '71000000-0000-4000-8000-000000000001',
        null,
        12
      )->'items'
    ) item
    limit 1
  ),
  'car',
  'post-consent category affinity produces a recommendation'
);
select extensions.is(
  (
    select count(*)::bigint
    from jsonb_array_elements(
      public.personalized_recommendation_service_v1(
        '71000000-0000-4000-8000-000000000001',
        null,
        12
      )->'items'
    ) item
    where item->>'categoryKey' = 'property'
  ),
  0::bigint,
  'pre-consent activity is excluded from personalized ranking'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.is(
  (public.set_my_recommendation_personalization_v1(false)->>'enabled')::boolean,
  false,
  'owner can disable personalization immediately'
);
reset role;

set local role service_role;
select extensions.is(
  public.personalized_recommendation_service_v1(
    '71000000-0000-4000-8000-000000000001',
    null,
    12
  )->>'reason',
  'personalization_not_enabled',
  'disabled personalization returns no ranking even while the service is enabled'
);
reset role;

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.is(
  (public.clear_my_recommendation_personalization_data_v1()->>'cleared')::boolean,
  true,
  'owner can clear account-linked recommendation activity'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  0::bigint,
  'owner clear removes all of the caller account-linked recommendation events'
);
select extensions.is(
  (public.get_my_recommendation_personalization_v1()->>'enabled')::boolean,
  false,
  'owner clear leaves personalization disabled'
);
reset role;

select extensions.is(
  (select count(*)::bigint
   from public.recommendation_personalization_preferences
   where user_id = '71000000-0000-4000-8000-000000000002'
     and enabled),
  1::bigint,
  'clearing one account does not alter another account preference'
);

select * from extensions.finish();
rollback;
