begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002001', 'recommendation-owner@example.test', '{"full_name":"Recommendation Owner"}', now(), now()),
  ('00000000-0000-4000-8000-000000002002', 'recommendation-unrelated@example.test', '{"full_name":"Recommendation Unrelated"}', now(), now()),
  ('00000000-0000-4000-8000-000000002003', 'recommendation-suspended@example.test', '{"full_name":"Recommendation Suspended"}', now(), now()),
  ('00000000-0000-4000-8000-000000002004', 'recommendation-moderator@example.test', '{"full_name":"Recommendation Moderator"}', now(), now()),
  ('00000000-0000-4000-8000-000000002005', 'recommendation-admin@example.test', '{"full_name":"Recommendation Admin"}', now(), now());

update public.users set status = 'suspended'
where id = '00000000-0000-4000-8000-000000002003';
update public.users set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-000000002005';

insert into public.locations (id, name, type, country_code, is_active)
values ('00000000-0000-4000-8000-000000002101', 'Recommendation Test City', 'city', 'ZW', true);

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
  verified,
  content_suspended_at
)
values
  (
    '00000000-0000-4000-8000-000000002201',
    'car',
    '00000000-0000-4000-8000-000000002001',
    'Recommendation Owner',
    'Well maintained Toyota Hilux double cab',
    'A complete public listing with service history, clear ownership information, recent maintenance and a detailed condition description.',
    25000,
    'USD',
    25000,
    'USD',
    '[{"path":"one"},{"path":"two"},{"path":"three"},{"path":"four"},{"path":"five"}]'::jsonb,
    '00000000-0000-4000-8000-000000002101',
    'ZW',
    'pickup-trucks',
    'sale',
    'available',
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000002202',
    'car',
    '00000000-0000-4000-8000-000000002001',
    'Recommendation Owner',
    'Private recommendation draft',
    'Draft listings must never enter recommendation projections.',
    10000,
    'USD',
    10000,
    'USD',
    '[]'::jsonb,
    '00000000-0000-4000-8000-000000002101',
    'ZW',
    'sedans',
    'sale',
    'draft',
    false,
    null
  ),
  (
    '00000000-0000-4000-8000-000000002203',
    'car',
    '00000000-0000-4000-8000-000000002001',
    'Recommendation Owner',
    'Suspended recommendation listing',
    'Suspended content must never enter recommendation projections.',
    12000,
    'USD',
    12000,
    'USD',
    '[]'::jsonb,
    '00000000-0000-4000-8000-000000002101',
    'ZW',
    'sedans',
    'sale',
    'available',
    false,
    now()
  );

insert into public.car_details (listing_id, brand, model, year, mileage, fuel_type, transmission, condition)
values
  ('00000000-0000-4000-8000-000000002201', 'Toyota', 'Hilux', 2022, 30000, 'diesel', 'automatic', 'used'),
  ('00000000-0000-4000-8000-000000002202', 'Toyota', 'Corolla', 2020, 45000, 'petrol', 'automatic', 'used'),
  ('00000000-0000-4000-8000-000000002203', 'Toyota', 'Corolla', 2019, 60000, 'petrol', 'manual', 'used');

insert into public.recommendation_taxonomy_nodes (node_type, stable_key, label, is_active)
values ('tag', 'inactive-test-tag', 'Inactive test tag', false)
on conflict (node_type, stable_key) do update set is_active = false;

select extensions.has_table('public', 'recommendation_taxonomy_nodes', 'taxonomy table exists');
select extensions.has_table('public', 'recommendation_relationships', 'relationship table exists');
select extensions.has_table('public', 'listing_recommendation_features', 'listing projection table exists');
select extensions.has_table('public', 'recommendation_events', 'partitioned event table exists');
select extensions.has_table('public', 'recommendation_cache', 'cache table exists');
select extensions.has_table('public', 'recommendation_popularity_daily', 'popularity aggregate table exists');
select extensions.has_table('public', 'recommendation_weight_profiles', 'weight profile table exists');
select extensions.has_table('public', 'recommendation_configuration_audit', 'configuration audit table exists');

select extensions.is(
  (select count(*)::bigint from public.listing_recommendation_features),
  1::bigint,
  'only public unsuspended listings are projected'
);
select extensions.is(
  (select category_key from public.listing_recommendation_features where listing_id = '00000000-0000-4000-8000-000000002201'),
  'car'::text,
  'projection stores the stable listing category'
);
select extensions.ok(
  (select specification_tokens @> array['toyota', 'hilux', 'diesel', 'automatic']
   from public.listing_recommendation_features
   where listing_id = '00000000-0000-4000-8000-000000002201'),
  'projection contains normalized category-specific specification tokens'
);
select extensions.ok(
  (select quality_score > 0.8
   from public.listing_recommendation_features
   where listing_id = '00000000-0000-4000-8000-000000002201'),
  'complete listings receive a deterministic quality score'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_weight_profiles where is_active),
  7::bigint,
  'one active deterministic profile exists for every Phase 2 service contract'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_weight_profiles profile
   where abs((select sum((entry.value #>> '{}')::numeric) from jsonb_each(profile.weights) entry) - 1) <= 0.000001),
  7::bigint,
  'every active weight profile totals one'
);
select extensions.ok(
  (select count(*) >= 10 from public.recommendation_relationships where is_active),
  'initial category-to-service and category-to-product relationships are available'
);

set local role anon;

select extensions.ok(
  (select count(*) > 0 from public.recommendation_taxonomy_nodes),
  'guest can read active taxonomy nodes'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_taxonomy_nodes where stable_key = 'inactive-test-tag'),
  0::bigint,
  'guest cannot read inactive taxonomy nodes'
);
select extensions.throws_matching(
  $$insert into public.recommendation_taxonomy_nodes (node_type, stable_key, label)
    values ('tag', 'guest-write', 'Guest write')$$,
  '.*permission denied for table recommendation_taxonomy_nodes.*',
  'guest cannot write taxonomy configuration'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301',
    p_context => '{"surface":"listing_detail","position":1}'::jsonb
  ),
  null::uuid,
  'guest can record a bounded public listing view'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'save',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301'
  )$$,
  '42501',
  'authentication required for this event',
  'guest cannot record an authenticated-only action'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301',
    p_context => '{"email":"private@example.test"}'::jsonb
  )$$,
  '22023',
  'event context contains an unsupported field',
  'guest cannot submit invasive context fields'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_events$$,
  '.*permission denied for table recommendation_events.*',
  'guest cannot read raw recommendation events'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
set local role authenticated;

select extensions.throws_matching(
  $$select count(*) from public.listing_recommendation_features$$,
  '.*permission denied for table listing_recommendation_features.*',
  'listing owner cannot read internal ranking projections directly'
);
select extensions.throws_matching(
  $$insert into public.recommendation_events (
      occurred_at, actor_id, event_type, listing_id, seller_id, expires_at
    ) values (
      now(),
      '00000000-0000-4000-8000-000000002001',
      'view',
      '00000000-0000-4000-8000-000000002201',
      '00000000-0000-4000-8000-000000002001',
      now() + interval '1 day'
    )$$,
  '.*permission denied for table recommendation_events.*',
  'listing owner cannot bypass the trusted event operation'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  ),
  null::uuid,
  'active owner can record an authenticated first-party event'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'search',
    p_context => '{"surface":"search","query_token_count":2,"result_count":14}'::jsonb
  ),
  null::uuid,
  'active owner can record a search without storing the query text'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_seller_id => '00000000-0000-4000-8000-000000002002'
  )$$,
  '22023',
  'listing seller attribution does not match',
  'caller cannot spoof listing seller attribution'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  2::bigint,
  'authenticated user reads only their own two events'
);
select extensions.throws_ok(
  $$select public.admin_upsert_recommendation_taxonomy_node('tag', 'owner-tag', 'Owner tag')$$,
  '42501',
  'admin access required',
  'ordinary owner cannot administer taxonomy'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  0::bigint,
  'unrelated user cannot read another account recommendation history'
);
select extensions.throws_ok(
  $$select public.admin_recommendation_configuration_snapshot()$$,
  '42501',
  'admin access required',
  'unrelated user cannot read private recommendation configuration'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002004', true);
set local role authenticated;

select extensions.is(public.is_admin(), false, 'moderator-labelled fixture has no hidden founder-admin privilege');
select extensions.throws_ok(
  $$select public.admin_upsert_recommendation_taxonomy_node('tag', 'moderator-tag', 'Moderator tag')$$,
  '42501',
  'admin access required',
  'moderator without founder-admin authority cannot change recommendation configuration'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002003', true);
set local role authenticated;

select extensions.is(public.is_active_user(), false, 'suspended fixture fails the active-account predicate');
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201'
  )$$,
  '42501',
  'active account required',
  'suspended user cannot add behavioural events'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  0::bigint,
  'suspended user cannot read behavioural history through RLS'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002005', true);
set local role authenticated;

select extensions.is(public.is_admin(), true, 'active founder-admin fixture passes the database predicate');
select extensions.isnt(
  public.admin_upsert_recommendation_taxonomy_node(
    'service',
    'admin-test-service',
    'Admin test service',
    null,
    '{"domain":"car"}'::jsonb,
    true
  ),
  null::uuid,
  'admin can create an audited taxonomy node'
);
select extensions.isnt(
  public.admin_upsert_recommendation_relationship(
    (select id from public.recommendation_taxonomy_nodes where node_type = 'category' and stable_key = 'car'),
    (select id from public.recommendation_taxonomy_nodes where node_type = 'service' and stable_key = 'admin-test-service'),
    'complements',
    0.7,
    'ADMIN_TEST_RELATIONSHIP',
    true
  ),
  null::uuid,
  'admin can create an audited contextual relationship'
);
select extensions.isnt(
  public.admin_upsert_recommendation_weight_profile(
    'similar-listings-service',
    1,
    'admin-test-v1',
    '{"category":0.5,"specifications":0.3,"quality":0.2}'::jsonb,
    true
  ),
  null::uuid,
  'admin can create and activate a valid deterministic weight profile'
);
select extensions.ok(
  public.admin_recommendation_configuration_snapshot() ?& array['taxonomy_nodes', 'relationships', 'weight_profiles', 'generated_at'],
  'admin receives the complete private configuration snapshot'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_configuration_audit where actor_id = auth.uid()),
  3::bigint,
  'every admin configuration change creates immutable before-and-after history'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_weight_profiles$$,
  '.*permission denied for table recommendation_weight_profiles.*',
  'browser admin still uses the audited function boundary instead of direct tables'
);
select extensions.throws_ok(
  $$update public.recommendation_configuration_audit
    set action = 'update'
    where actor_id = auth.uid()$$,
  '42501',
  'recommendation configuration audit history is immutable',
  'audit rows cannot be rewritten'
);

reset role;
set local role service_role;

select extensions.lives_ok(
  $$select * from public.refresh_listing_recommendation_features_batch(null, 100)$$,
  'service worker can refresh listing projections in a bounded batch'
);
select extensions.lives_ok(
  $$select public.refresh_recommendation_popularity_daily(current_date)$$,
  'service worker can rebuild one day of popularity aggregates'
);
select extensions.lives_ok(
  $$select * from public.purge_expired_recommendation_data(100)$$,
  'service worker can purge expired events and cache entries in a bounded batch'
);
select extensions.lives_ok(
  $$select public.ensure_recommendation_event_partition((current_date + interval '5 months')::date)$$,
  'service worker can provision a future monthly event partition'
);

reset role;

select extensions.ok(
  has_function_privilege(
    'anon',
    'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'guest has only the bounded ingestion function'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.purge_expired_recommendation_data(integer)',
    'EXECUTE'
  ),
  'browser roles cannot run retention workers'
);
select extensions.is(
  (select count(*)::bigint
   from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relname in (
       'recommendation_taxonomy_nodes',
       'recommendation_relationships',
       'listing_recommendation_features',
       'recommendation_events',
       'recommendation_events_default',
       'recommendation_cache',
       'recommendation_popularity_daily',
       'recommendation_weight_profiles',
       'recommendation_configuration_audit'
     )
     and relation.relrowsecurity),
  9::bigint,
  'every core Phase 1 table and default partition has RLS enabled'
);
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_similarity', 'similarity cursor index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_seller', 'seller cursor index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_location', 'location cursor index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_recent', 'recent listing cursor index exists');
select extensions.has_index('public', 'recommendation_events', 'idx_recommendation_events_actor_cursor', 'actor event cursor index exists');
select extensions.has_index('public', 'recommendation_events', 'idx_recommendation_events_request_cursor', 'recommendation attribution cursor index exists');

select * from extensions.finish();
rollback;
