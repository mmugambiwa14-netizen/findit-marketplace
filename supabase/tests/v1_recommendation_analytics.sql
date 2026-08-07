begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('72000000-0000-4000-8000-000000000001', 'analytics-admin@example.test', '{"full_name":"Analytics Admin"}', now(), now()),
  ('72000000-0000-4000-8000-000000000002', 'analytics-viewer@example.test', '{"full_name":"Analytics Viewer"}', now(), now()),
  ('72000000-0000-4000-8000-000000000003', 'analytics-seller@example.test', '{"full_name":"Analytics Seller"}', now(), now());

update public.users
set role = 'admin', super_admin = true
where id = '72000000-0000-4000-8000-000000000001';

insert into public.locations (id, name, type, country_code, is_active)
values (
  '72000000-0000-4000-8000-000000000101',
  'Analytics Test City',
  'city',
  'ZW',
  true
);

-- This controlled public listing is fixture setup, but it must still cross the
-- authoritative curated publisher boundary exactly as runtime does. Fixture auth
-- is opened only for the insert and cleared before any assertion runs.
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
  '72000000-0000-4000-8000-000000000401',
  '72000000-0000-4000-8000-000000000003',
  'Analytics Test Motors',
  'Analytics Seller',
  'analytics-seller@example.test',
  '+263700000401',
  'ZW',
  'Analytics Test City',
  'Approved fixture business used only to certify recommendation analytics boundaries.',
  '1-10',
  'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
)
values (
  '72000000-0000-4000-8000-000000000402',
  '72000000-0000-4000-8000-000000000401',
  '72000000-0000-4000-8000-000000000003',
  'car',
  'approved'
);

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified
)
values (
  '72000000-0000-4000-8000-000000000201',
  'car',
  '72000000-0000-4000-8000-000000000003',
  'Analytics Seller',
  'Analytics attribution vehicle',
  'A complete public vehicle used to verify aggregate recommendation delivery metrics without exposing customer identity.',
  19000,
  'USD',
  19000,
  'USD',
  '[{"path":"one"},{"path":"two"}]'::jsonb,
  '72000000-0000-4000-8000-000000000101',
  'ZW',
  'sedans',
  'sale',
  'available',
  true
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select extensions.has_table(
  'public',
  'recommendation_service_metrics_daily',
  'aggregate recommendation analytics table exists'
);
select extensions.has_function(
  'public',
  'refresh_recommendation_service_metrics_daily_v1',
  array['date'],
  'bounded analytics refresh function exists'
);
select extensions.has_function(
  'public',
  'admin_recommendation_analytics_v1',
  array['date', 'date'],
  'admin aggregate report function exists'
);
select extensions.hasnt_column(
  'public',
  'recommendation_service_metrics_daily',
  'actor_id',
  'aggregate metrics contain no actor identity'
);
select extensions.hasnt_column(
  'public',
  'recommendation_service_metrics_daily',
  'anonymous_session_id',
  'aggregate metrics contain no anonymous session identity'
);
select extensions.hasnt_column(
  'public',
  'recommendation_service_metrics_daily',
  'listing_id',
  'aggregate metrics contain no listing identity'
);
select extensions.hasnt_column(
  'public',
  'recommendation_service_metrics_daily',
  'recommendation_request_id',
  'aggregate metrics contain no request identity'
);

select extensions.throws_ok(
  $$insert into public.recommendation_events (
      actor_id, event_type, listing_id, seller_id, recommendation_request_id,
      recommendation_service, reason_code, context, expires_at
    ) values (
      '72000000-0000-4000-8000-000000000002',
      'recommendation_impression',
      '72000000-0000-4000-8000-000000000201',
      '72000000-0000-4000-8000-000000000003',
      '72000000-0000-4000-8000-000000000301',
      'recently-listed-service',
      'RECENTLY_LISTED',
      '{"surface":"listing_detail","source":"listing:recent","position":30,"page_size":6,"result_count":6}'::jsonb,
      now() + interval '180 days'
    )$$,
  '22023',
  'recommendation analytics context is invalid',
  'table boundary rejects out-of-range recommendation attribution'
);

insert into public.recommendation_events (
  actor_id,
  event_type,
  listing_id,
  seller_id,
  recommendation_request_id,
  recommendation_service,
  reason_code,
  context,
  expires_at
)
values
  (
    '72000000-0000-4000-8000-000000000002',
    'recommendation_impression',
    '72000000-0000-4000-8000-000000000201',
    '72000000-0000-4000-8000-000000000003',
    '72000000-0000-4000-8000-000000000301',
    'recently-listed-service',
    'RECENTLY_LISTED',
    '{"surface":"listing_detail","source":"listing:recent","position":0,"page_size":2,"result_count":2}'::jsonb,
    now() + interval '180 days'
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    'recommendation_impression',
    '72000000-0000-4000-8000-000000000201',
    '72000000-0000-4000-8000-000000000003',
    '72000000-0000-4000-8000-000000000301',
    'recently-listed-service',
    'RECENTLY_LISTED',
    '{"surface":"listing_detail","source":"listing:recent","position":1,"page_size":2,"result_count":2}'::jsonb,
    now() + interval '180 days'
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    'recommendation_click',
    '72000000-0000-4000-8000-000000000201',
    '72000000-0000-4000-8000-000000000003',
    '72000000-0000-4000-8000-000000000301',
    'recently-listed-service',
    'RECENTLY_LISTED',
    '{"surface":"listing_detail","source":"listing:recent","position":1,"page_size":2,"result_count":2}'::jsonb,
    now() + interval '180 days'
  );

set local role service_role;
select extensions.is(
  public.refresh_recommendation_service_metrics_daily_v1(current_date),
  1,
  'worker refreshes one aggregate metric group'
);
select extensions.is(
  (select impression_count
   from public.recommendation_service_metrics_daily
   where metric_date = current_date
     and service_name = 'recently-listed-service'),
  2::bigint,
  'daily metrics count visible recommendation impressions'
);
select extensions.is(
  (select click_count
   from public.recommendation_service_metrics_daily
   where metric_date = current_date
     and service_name = 'recently-listed-service'),
  1::bigint,
  'daily metrics count explicit recommendation opens'
);
select extensions.is(
  (select request_count
   from public.recommendation_service_metrics_daily
   where metric_date = current_date
     and service_name = 'recently-listed-service'),
  1::bigint,
  'daily metrics count distinct opaque requests only in aggregate'
);
select extensions.ok(
  public.recommendation_analytics_health_v1()
    ?& array['latestMetricDate', 'latestRefreshAt', 'metricRows', 'retentionDays', 'generatedAt'],
  'service health exposes only aggregate readiness'
);
select extensions.throws_ok(
  $$select public.purge_recommendation_service_metrics_v1(current_date, 100)$$,
  '22023',
  'invalid analytics retention request',
  'retention cannot delete recent aggregate evidence'
);
reset role;

set local role anon;
select extensions.throws_matching(
  $$select count(*) from public.recommendation_service_metrics_daily$$,
  '.*permission denied for table recommendation_service_metrics_daily.*',
  'anonymous callers cannot read aggregate analytics storage'
);
select extensions.throws_matching(
  $$select public.admin_recommendation_analytics_v1(current_date, current_date)$$,
  '.*permission denied for function admin_recommendation_analytics_v1.*',
  'anonymous callers cannot execute admin analytics'
);
reset role;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.admin_recommendation_analytics_v1(current_date, current_date)$$,
  '42501',
  'admin access required',
  'ordinary authenticated users cannot read recommendation analytics'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_service_metrics_daily$$,
  '.*permission denied for table recommendation_service_metrics_daily.*',
  'ordinary authenticated users cannot bypass the report contract'
);
reset role;

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.is(
  (
    public.admin_recommendation_analytics_v1(current_date, current_date)
      ->'summary'->>'impressions'
  )::bigint,
  2::bigint,
  'admin report returns aggregate impression totals'
);
select extensions.is(
  (
    public.admin_recommendation_analytics_v1(current_date, current_date)
      ->'summary'->>'clickThroughRate'
  )::numeric,
  0.5::numeric,
  'admin report computes aggregate click-through rate'
);
select extensions.ok(
  not (
    lower(public.admin_recommendation_analytics_v1(current_date, current_date)::text)
      ~ 'actor_id|anonymous_session_id|listing_id|seller_id|recommendation_request_id'
  ),
  'admin report contains no behavioural identity fields'
);
select extensions.throws_ok(
  $$select public.admin_recommendation_analytics_v1(current_date - 90, current_date)$$,
  '22023',
  'analytics date range is invalid',
  'admin report rejects ranges longer than 90 days'
);
reset role;

insert into public.recommendation_service_metrics_daily (
  metric_date,
  service_name,
  reason_code,
  surface,
  impression_count
)
values (
  current_date - 401,
  'recently-listed-service',
  'RECENTLY_LISTED',
  'listing_detail',
  1
);

set local role service_role;
select extensions.is(
  public.purge_recommendation_service_metrics_v1(current_date - 400, 100),
  1,
  'worker purges only expired aggregate analytics in a bounded batch'
);
reset role;

select * from extensions.finish();
rollback;
