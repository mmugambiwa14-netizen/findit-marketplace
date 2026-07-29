begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', 'geo-seller@example.test', '{"full_name":"Geo Seller"}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'geo-buyer@example.test', '{"full_name":"Geo Buyer"}', now(), now());

insert into public.locations (
  id, name, type, country_code, latitude, longitude, is_active
) values (
  '20000000-0000-4000-8000-000000000101',
  'Geospatial Test City',
  'city',
  'ZW',
  -17.8252,
  31.0335,
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified, latitude, longitude
) values (
  '20000000-0000-4000-8000-000000000201',
  'car',
  '20000000-0000-4000-8000-000000000001',
  'Geo Seller',
  'Geospatial recommendation test vehicle',
  'A public vehicle used to prove active-seller eligibility, privacy-safe public geography and deletion-compatible recommendation events.',
  18000,
  'USD',
  18000,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '20000000-0000-4000-8000-000000000101',
  'ZW',
  'pickup-trucks',
  'sale',
  'available',
  true,
  -17.7000,
  31.2000
);

insert into public.car_details (
  listing_id, brand, model, year, mileage, fuel_type, transmission, condition
) values (
  '20000000-0000-4000-8000-000000000201',
  'Toyota', 'Hilux', 2021, 40000, 'diesel', 'automatic', 'used'
);

set local role service_role;
select extensions.is(
  (select succeeded_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  1,
  'projection worker builds the active seller listing projection'
);
reset role;

select extensions.ok(
  (select feature.public_location is not null
   from public.listing_recommendation_features feature
   where feature.listing_id = '20000000-0000-4000-8000-000000000201'),
  'projection contains privacy-safe public geography'
);
select extensions.ok(
  (select extensions.st_equals(
      feature.public_location::extensions.geometry,
      listing.public_location::extensions.geometry
    )
   from public.listing_recommendation_features feature
   join public.listings listing on listing.id = feature.listing_id
   where feature.listing_id = '20000000-0000-4000-8000-000000000201'),
  'projection geography exactly matches the canonical public location'
);
select extensions.ok(
  (select not extensions.st_equals(
      feature.public_location::extensions.geometry,
      extensions.st_setsrid(
        extensions.st_makepoint(listing.longitude::double precision, listing.latitude::double precision),
        4326
      )
    )
   from public.listing_recommendation_features feature
   join public.listings listing on listing.id = feature.listing_id
   where feature.listing_id = '20000000-0000-4000-8000-000000000201'),
  'exact owner-supplied coordinates are not projected'
);
select extensions.has_index(
  'public',
  'listing_recommendation_features',
  'idx_listing_recommendation_public_location',
  'privacy-safe geography has a GiST index'
);

set local enable_seqscan = off;
create or replace function pg_temp.recommendation_geo_explain(p_sql text)
returns text
language plpgsql
as $$
declare
  plan json;
begin
  execute 'explain (format json, costs off) ' || p_sql into plan;
  return plan::text;
end;
$$;

select extensions.matches(
  pg_temp.recommendation_geo_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where extensions.st_dwithin(
      public_location,
      extensions.st_setsrid(extensions.st_makepoint(31.03, -17.82), 4326)::extensions.geography,
      50000
    )
    limit 20
  $query$),
  'idx_listing_recommendation_public_location',
  'nearby query uses the public geography GiST index'
);
reset enable_seqscan;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '20000000-0000-4000-8000-000000000201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  ),
  null::uuid,
  'active buyer can record an event for an active seller listing'
);
reset role;

update public.users
set status = 'suspended'
where id = '20000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '20000000-0000-4000-8000-000000000201'),
  0::bigint,
  'seller suspension removes projections immediately without waiting for a worker'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '20000000-0000-4000-8000-000000000201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  )$$,
  '22023',
  'event subject is not publicly eligible',
  'events cannot target listings owned by suspended sellers'
);
reset role;

update public.users
set status = 'active'
where id = '20000000-0000-4000-8000-000000000001';

set local role service_role;
select extensions.ok(
  (select succeeded_count >= 1 from public.process_listing_recommendation_projection_jobs(20, 8)),
  'seller restoration requeues and rebuilds the projection'
);
reset role;

select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '20000000-0000-4000-8000-000000000201'),
  1::bigint,
  'restored active seller listing returns to the projection surface'
);

select extensions.is(
  (select count(*)::bigint
   from public.recommendation_events
   where actor_id = '20000000-0000-4000-8000-000000000002'),
  1::bigint,
  'the pre-suspension buyer event exists before account deletion'
);

select extensions.lives_ok(
  $$delete from auth.users where id = '20000000-0000-4000-8000-000000000002'$$,
  'account deletion is not blocked by behavioural event identity constraints'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_events
   where actor_id = '20000000-0000-4000-8000-000000000002'),
  0::bigint,
  'authenticated behavioural events are removed when their actor account is deleted'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000003',
  'geo-second-buyer@example.test',
  '{"full_name":"Geo Second Buyer"}',
  now(),
  now()
);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '20000000-0000-4000-8000-000000000201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  ),
  null::uuid,
  'second buyer creates a deletion-cascade fixture event'
);
reset role;

select extensions.lives_ok(
  $$delete from public.listings where id = '20000000-0000-4000-8000-000000000201'$$,
  'listing deletion is not blocked by recommendation subject constraints'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_events
   where listing_id = '20000000-0000-4000-8000-000000000201'),
  0::bigint,
  'listing-scoped behavioural events cascade with an explicitly deleted listing'
);
select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '20000000-0000-4000-8000-000000000201'),
  0::bigint,
  'listing projection is removed with the deleted listing'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_projection_jobs
   where listing_id = '20000000-0000-4000-8000-000000000201'),
  0::bigint,
  'pending projection work is removed with the deleted listing'
);

select * from extensions.finish();
rollback;
