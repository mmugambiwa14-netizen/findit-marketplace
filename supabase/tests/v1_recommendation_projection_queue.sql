begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '20000000-0000-4000-8000-000000000001',
  'recommendation-queue-owner@example.test',
  '{"full_name":"Recommendation Queue Owner"}',
  now(),
  now()
);

insert into public.locations (id, name, type, country_code, is_active)
values (
  '20000000-0000-4000-8000-000000000002',
  'Queue Test City',
  'city',
  'ZW',
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
  status
) values (
  '20000000-0000-4000-8000-000000000003',
  'car',
  '20000000-0000-4000-8000-000000000001',
  'Recommendation Queue Owner',
  'Queue test vehicle',
  'A public vehicle used to prove that recommendation infrastructure cannot block listing writes.',
  15000,
  'USD',
  15000,
  'USD',
  '[{"path":"one"}]'::jsonb,
  '20000000-0000-4000-8000-000000000002',
  'ZW',
  'queue-test',
  'sale',
  'available'
);

insert into public.car_details (
  listing_id, brand, model, year, mileage, fuel_type, transmission, condition
) values (
  '20000000-0000-4000-8000-000000000003',
  'Toyota',
  'Hilux',
  2022,
  25000,
  'diesel',
  'automatic',
  'used'
);

select extensions.has_table(
  'public',
  'recommendation_projection_jobs',
  'asynchronous projection queue exists'
);
select extensions.has_table(
  'public',
  'recommendation_projection_dead_letters',
  'projection dead-letter evidence table exists'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_projection_jobs
   where listing_id = '20000000-0000-4000-8000-000000000003'),
  1::bigint,
  'listing and detail writes coalesce into one pending projection job'
);

alter table public.recommendation_projection_jobs
  add constraint recommendation_projection_jobs_test_failure
  check (false) not valid;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.lives_ok(
  $$update public.listings
    set title = 'Queue failure did not block this update'
    where id = '20000000-0000-4000-8000-000000000003'$$,
  'listing update succeeds even when projection enqueue fails'
);
select extensions.is(
  (select title
   from public.listings
   where id = '20000000-0000-4000-8000-000000000003'),
  'Queue failure did not block this update'::text,
  'authoritative listing data commits independently of recommendation infrastructure'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_projection_jobs$$,
  '.*permission denied for table recommendation_projection_jobs.*',
  'listing owner cannot read internal projection jobs'
);
select extensions.throws_ok(
  $$select * from public.process_listing_recommendation_projection_jobs(10, 1)$$,
  '42501',
  'permission denied for function process_listing_recommendation_projection_jobs',
  'browser role cannot invoke the projection worker'
);

reset role;
alter table public.recommendation_projection_jobs
  drop constraint recommendation_projection_jobs_test_failure;

alter table public.listing_recommendation_features
  add constraint listing_recommendation_features_test_failure
  check (false) not valid;

set local role service_role;
select extensions.is(
  (select dead_lettered_count
   from public.process_listing_recommendation_projection_jobs(10, 1)),
  1,
  'a failed projection is dead-lettered after the configured bounded attempts'
);

reset role;
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_projection_jobs
   where listing_id = '20000000-0000-4000-8000-000000000003'),
  0::bigint,
  'dead-lettered work leaves the active queue'
);
select extensions.is(
  (select reason_code
   from public.recommendation_projection_dead_letters
   where listing_id = '20000000-0000-4000-8000-000000000003'
   order by id desc
   limit 1),
  'projection_failed'::text,
  'dead-letter evidence stores only a stable error code'
);
select extensions.ok(
  not exists (
    select 1
    from public.recommendation_projection_dead_letters
    where reason_code ~* '(error|exception|relation|column|constraint|sql)'
  ),
  'dead letters do not persist raw database errors'
);

alter table public.listing_recommendation_features
  drop constraint listing_recommendation_features_test_failure;

set local role service_role;
select extensions.is(
  public.retry_recommendation_projection_dead_letter(
    (select id
     from public.recommendation_projection_dead_letters
     where listing_id = '20000000-0000-4000-8000-000000000003'
     order by id desc
     limit 1)
  ),
  true,
  'service worker can explicitly retry a retained dead letter'
);
select extensions.is(
  (select succeeded_count
   from public.process_listing_recommendation_projection_jobs(10, 8)),
  1,
  'retried projection succeeds after the dependency recovers'
);

reset role;
select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '20000000-0000-4000-8000-000000000003'),
  1::bigint,
  'successful worker execution creates the listing projection'
);
select extensions.ok(
  (select retried_at is not null
   from public.recommendation_projection_dead_letters
   where listing_id = '20000000-0000-4000-8000-000000000003'
   order by id desc
   limit 1),
  'dead-letter retry is durably attributed without deleting evidence'
);

update public.listings
set content_suspended_at = now()
where id = '20000000-0000-4000-8000-000000000003';

set local role service_role;
select extensions.is(
  (select succeeded_count
   from public.process_listing_recommendation_projection_jobs(10, 8)),
  1,
  'worker processes the suspension projection job'
);

reset role;
select extensions.is(
  (select count(*)::bigint
   from public.listing_recommendation_features
   where listing_id = '20000000-0000-4000-8000-000000000003'),
  0::bigint,
  'suspended content is removed from recommendation projections without affecting its preserved listing record'
);

select extensions.has_index(
  'public',
  'recommendation_projection_jobs',
  'idx_recommendation_projection_jobs_due',
  'due-job worker index exists'
);
select extensions.has_index(
  'public',
  'recommendation_projection_dead_letters',
  'idx_recommendation_projection_dead_letters_unretried',
  'unretried dead-letter index exists'
);
select extensions.is(
  (select count(*)::bigint
   from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relname in (
       'recommendation_projection_jobs',
       'recommendation_projection_dead_letters'
     )
     and relation.relrowsecurity),
  2::bigint,
  'both projection worker tables enforce RLS'
);

select * from extensions.finish();
rollback;
