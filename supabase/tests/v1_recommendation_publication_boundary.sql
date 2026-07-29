begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', 'publication-seller@example.test', '{"full_name":"Publication Seller"}', now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'publication-buyer@example.test', '{"full_name":"Publication Buyer"}', now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'publication-suspended-actor@example.test', '{"full_name":"Suspended Actor"}', now(), now());

update public.users
set status = 'suspended'
where id = '30000000-0000-4000-8000-000000000003';

insert into public.locations (id, name, type, country_code, latitude, longitude, is_active)
values (
  '30000000-0000-4000-8000-000000000101',
  'Publication Test City',
  'city',
  'ZW',
  -17.8252,
  31.0335,
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified
) values (
  '30000000-0000-4000-8000-000000000201',
  'car',
  '30000000-0000-4000-8000-000000000001',
  'Publication Seller',
  'Publication boundary test vehicle',
  'A complete public listing used to prove that stale projection rows cannot bypass current listing publication, suspension or seller eligibility.',
  22000,
  'USD',
  22000,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '30000000-0000-4000-8000-000000000101',
  'ZW',
  'pickup-trucks',
  'sale',
  'available',
  true
);

insert into public.car_details (
  listing_id, brand, model, year, mileage, fuel_type, transmission, condition
) values (
  '30000000-0000-4000-8000-000000000201',
  'Ford', 'Ranger', 2022, 25000, 'diesel', 'automatic', 'used'
);

set local role service_role;
select extensions.is(
  (select succeeded_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  1,
  'worker builds the initial public projection'
);
select extensions.is(
  (select count(*)::bigint
   from public.eligible_listing_recommendation_features
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  1::bigint,
  'service eligibility view exposes the active public listing'
);
reset role;

select extensions.has_view(
  'public',
  'eligible_listing_recommendation_features',
  'service-only publication eligibility view exists'
);

set local role anon;
select extensions.throws_matching(
  $$select count(*) from public.eligible_listing_recommendation_features$$,
  '.*permission denied for view eligible_listing_recommendation_features.*',
  'guest cannot query internal eligible projections'
);
reset role;

set local role authenticated;
select extensions.throws_matching(
  $$select count(*) from public.eligible_listing_recommendation_features$$,
  '.*permission denied for view eligible_listing_recommendation_features.*',
  'authenticated browser roles cannot query internal eligible projections'
);
reset role;

update public.listings
set content_suspended_at = now(), content_suspension_reason = 'certification_test'
where id = '30000000-0000-4000-8000-000000000201';

select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  0::bigint,
  'content suspension removes the projection immediately on a best-effort basis'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_projection_jobs
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  1::bigint,
  'content suspension still coalesces reconciliation work'
);

set local role service_role;
insert into public.listing_recommendation_features (
  listing_id, seller_id, category_key, subcategory_key, country_code,
  location_key, price_amount, currency, quality_score, freshness_score,
  popularity_score, published_at, projection_version
) values (
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000001',
  'car',
  'pickup-trucks',
  'ZW',
  '30000000-0000-4000-8000-000000000101',
  22000,
  'USD',
  1,
  1,
  0,
  now(),
  1
)
on conflict (listing_id) do update set projected_at = now();

select extensions.is(
  (select count(*)::bigint
   from public.eligible_listing_recommendation_features
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  0::bigint,
  'a deliberately injected stale row cannot bypass current suspension state'
);
reset role;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '30000000-0000-4000-8000-000000000201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  )$$,
  '22023',
  'listing is not publicly available',
  'event collection rejects a suspended listing even if a stale feature row exists'
);
reset role;

update public.listings
set content_suspended_at = null, content_suspension_reason = null
where id = '30000000-0000-4000-8000-000000000201';

set local role service_role;
select extensions.ok(
  (select succeeded_count >= 1 from public.process_listing_recommendation_projection_jobs(20, 8)),
  'restoring content rebuilds the queued projection'
);
select extensions.is(
  (select count(*)::bigint
   from public.eligible_listing_recommendation_features
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  1::bigint,
  'restored public content returns to the service eligibility view'
);
reset role;

update public.listings
set status = 'draft'
where id = '30000000-0000-4000-8000-000000000201';

select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '30000000-0000-4000-8000-000000000201'),
  0::bigint,
  'non-public listing status removes the raw projection immediately'
);

update public.listings
set status = 'available'
where id = '30000000-0000-4000-8000-000000000201';

set local role service_role;
select extensions.ok(
  (select succeeded_count >= 1 from public.process_listing_recommendation_projection_jobs(20, 8)),
  'republishing queues and rebuilds the listing projection'
);
select extensions.throws_ok(
  $$insert into public.recommendation_events (
      id, occurred_at, actor_id, event_type, listing_id, seller_id, context, expires_at
    ) values (
      '30000000-0000-4000-8000-000000000301',
      now(),
      '30000000-0000-4000-8000-000000000003',
      'view',
      '30000000-0000-4000-8000-000000000201',
      '30000000-0000-4000-8000-000000000001',
      '{"surface":"service_test"}'::jsonb,
      now() + interval '30 days'
    )$$,
  '42501',
  'event actor is not active',
  'table-level validation rejects direct events attributed to suspended actors'
);
reset role;

select * from extensions.finish();
rollback;
