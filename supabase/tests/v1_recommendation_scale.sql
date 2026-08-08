begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'recommendation-scale@example.test',
  '{"full_name":"Recommendation Scale"}',
  now(),
  now()
);

insert into public.locations (id, name, type, country_code, is_active)
values ('10000000-0000-4000-8000-000000000002', 'Scale Test City', 'city', 'ZW', true);

-- The scale fixture is setup, but every listing row still has to cross the
-- authoritative curated publisher boundary exactly as runtime does.
-- enforce_curated_listing_publisher() matches on the listing's kind, so this
-- seller needs an approved 'car' category and a matching JWT subject. Fixture
-- auth is opened only for the inserts and cleared before any worker or
-- assertion runs.
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
  '10000000-0000-4000-8000-000000009001',
  '10000000-0000-4000-8000-000000000001',
  'Recommendation Scale Motors',
  'Recommendation Scale',
  'recommendation-scale@example.test',
  '+263700009001',
  'ZW',
  'Scale Test City',
  'Approved fixture business used only to certify recommendation scale boundaries.',
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
  '10000000-0000-4000-8000-000000009002',
  '10000000-0000-4000-8000-000000009001',
  '10000000-0000-4000-8000-000000000001',
  'car',
  'approved'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id,
  kind,
  seller_id,
  seller_name,
  title,
  description,
  price,
  currency,
  native_price,
  native_currency,
  photos,
  location_id,
  country_code,
  category,
  listing_type,
  status,
  created_at,
  updated_at
)
select
  ('10000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'car',
  '10000000-0000-4000-8000-000000000001',
  'Recommendation Scale',
  'Scale listing ' || series,
  'A deterministic scale fixture used to prove cursor stability and index-backed recommendation projection queries.',
  10000 + series,
  'USD',
  10000 + series,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '10000000-0000-4000-8000-000000000002',
  'ZW',
  'utility',
  'sale',
  'available',
  now() - make_interval(secs => series),
  now() - make_interval(secs => series)
from generate_series(1, 2000) series;

insert into public.car_details (
  listing_id,
  brand,
  model,
  year,
  mileage,
  fuel_type,
  transmission,
  condition
)
select
  ('10000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  case when series % 2 = 0 then 'Toyota' else 'Ford' end,
  case when series % 2 = 0 then 'Hilux' else 'Ranger' end,
  2018 + (series % 7),
  series * 100,
  'diesel',
  (case when series % 2 = 0 then 'automatic' else 'manual' end)::car_transmission,
  'used'
from generate_series(1, 2000) series;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

-- Projection is asynchronous (queue-based, not a synchronous write-time
-- side effect); drain the queue with the same bounded worker the production
-- scheduler uses before asserting on listing_recommendation_features.
do $$
declare
  drained integer;
begin
  loop
    select processed_count into drained
    from public.process_listing_recommendation_projection_jobs(500, 8);
    exit when drained = 0;
  end loop;
end $$;

analyze public.listing_recommendation_features;
set local enable_seqscan = off;

create or replace function pg_temp.recommendation_explain(p_sql text)
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

select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where seller_id = '10000000-0000-4000-8000-000000000001'),
  2000::bigint,
  'scale fixture projects every public listing without offset materialization'
);

select extensions.matches(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where category_key = 'car'
      and subcategory_key = 'utility'
      and country_code = 'ZW'
      and price_amount between 10500 and 11500
    order by price_amount, published_at desc, listing_id
    limit 25
  $query$),
  'idx_listing_recommendation_similarity',
  'similarity query uses the composite similarity index'
);

select extensions.matches(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where seller_id = '10000000-0000-4000-8000-000000000001'
    order by published_at desc, listing_id
    limit 25
  $query$),
  'idx_listing_recommendation_seller',
  'seller query uses the seller cursor index'
);

select extensions.matches(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where location_key = '10000000-0000-4000-8000-000000000002'
      and category_key = 'car'
    order by published_at desc, listing_id
    limit 25
  $query$),
  'idx_listing_recommendation_location',
  'location query uses the location cursor index'
);

select extensions.matches(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where country_code = 'ZW'
    order by published_at desc, listing_id desc
    limit 25
  $query$),
  'idx_listing_recommendation_recent',
  'recent listing query uses the country and publication cursor index'
);

create temporary table recommendation_first_page on commit drop as
select listing_id, published_at
from public.listing_recommendation_features
where category_key = 'car'
  and country_code = 'ZW'
order by published_at desc, listing_id desc
limit 25;

-- The concurrent-insert row crosses the same curated publisher boundary, so
-- reopen fixture auth for just this insert.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id,
  kind,
  seller_id,
  seller_name,
  title,
  description,
  price,
  currency,
  native_price,
  native_currency,
  photos,
  location_id,
  country_code,
  category,
  listing_type,
  status,
  created_at,
  updated_at
) values (
  '10000000-0000-4000-8000-999999999999',
  'car',
  '10000000-0000-4000-8000-000000000001',
  'Recommendation Scale',
  'Concurrent insert after first page',
  'This row is newer than the first-page cursor and must not shift or duplicate the second cursor page.',
  50000,
  'USD',
  50000,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '10000000-0000-4000-8000-000000000002',
  'ZW',
  'utility',
  'sale',
  'available',
  now() + interval '1 second',
  now() + interval '1 second'
);

insert into public.car_details (listing_id, brand, model, year, mileage, fuel_type, transmission, condition)
values (
  '10000000-0000-4000-8000-999999999999',
  'Toyota',
  'Land Cruiser',
  2024,
  1000,
  'diesel',
  'automatic',
  'used'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select processed_count from public.process_listing_recommendation_projection_jobs(10, 8);

create temporary table recommendation_second_page on commit drop as
with cursor_value as (
  select published_at, listing_id
  from recommendation_first_page
  order by published_at, listing_id
  limit 1
)
select feature.listing_id, feature.published_at
from public.listing_recommendation_features feature
cross join cursor_value cursor
where feature.category_key = 'car'
  and feature.country_code = 'ZW'
  and (feature.published_at, feature.listing_id) < (cursor.published_at, cursor.listing_id)
order by feature.published_at desc, feature.listing_id desc
limit 25;

select extensions.is(
  (select count(*)::bigint from recommendation_first_page),
  25::bigint,
  'first cursor page is full'
);
select extensions.is(
  (select count(*)::bigint from recommendation_second_page),
  25::bigint,
  'second cursor page remains full after a concurrent insert'
);
select extensions.is(
  (select count(*)::bigint
   from recommendation_first_page first_page
   join recommendation_second_page second_page using (listing_id)),
  0::bigint,
  'cursor pages contain no duplicates after a concurrent insert'
);
select extensions.is(
  (select count(*)::bigint
   from recommendation_second_page
   where listing_id = '10000000-0000-4000-8000-999999999999'),
  0::bigint,
  'newer concurrent inserts do not leak into the next page'
);

select * from extensions.finish();
rollback;
