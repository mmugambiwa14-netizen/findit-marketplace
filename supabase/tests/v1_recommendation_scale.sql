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
  'scale-cars',
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
  case when series % 2 = 0 then 'automatic' else 'manual' end,
  'used'
from generate_series(1, 2000) series;

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

select extensions.like(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where category_key = 'car'
      and subcategory_key = 'scale-cars'
      and country_code = 'ZW'
      and price_amount between 10500 and 11500
    order by price_amount, published_at desc, listing_id
    limit 25
  $query$),
  '%idx_listing_recommendation_similarity%',
  'similarity query uses the composite similarity index'
);

select extensions.like(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where seller_id = '10000000-0000-4000-8000-000000000001'
    order by published_at desc, listing_id
    limit 25
  $query$),
  '%idx_listing_recommendation_seller%',
  'seller query uses the seller cursor index'
);

select extensions.like(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where location_key = '10000000-0000-4000-8000-000000000002'
      and category_key = 'car'
    order by published_at desc, listing_id
    limit 25
  $query$),
  '%idx_listing_recommendation_location%',
  'location query uses the location cursor index'
);

select extensions.like(
  pg_temp.recommendation_explain($query$
    select listing_id
    from public.listing_recommendation_features
    where country_code = 'ZW'
    order by published_at desc, listing_id desc
    limit 25
  $query$),
  '%idx_listing_recommendation_recent%',
  'recent listing query uses the country and publication cursor index'
);

create temporary table recommendation_first_page on commit drop as
select listing_id, published_at
from public.listing_recommendation_features
where category_key = 'car'
  and country_code = 'ZW'
order by published_at desc, listing_id desc
limit 25;

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
  'scale-cars',
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
