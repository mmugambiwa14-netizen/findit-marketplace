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

update public.users
set status = 'suspended'
where id = '00000000-0000-4000-8000-000000002003';

update public.users
set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-000000002005';

insert into public.locations (id, name, type, country_code, is_active)
values ('00000000-0000-4000-8000-000000002101', 'Recommendation Test City', 'city', 'ZW', true);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  native_price, native_currency, photos, location_id, country_code, category,
  listing_type, status, verified, content_suspended_at
)
values
  (
    '00000000-0000-4000-8000-000000002201', 'car',
    '00000000-0000-4000-8000-000000002001', 'Recommendation Owner',
    'Well maintained Toyota Hilux double cab',
    'A complete public listing with service history, ownership information, recent maintenance, accurate specifications and a detailed condition description.',
    25000, 'USD', 25000, 'USD',
    '[{"path":"one"},{"path":"two"},{"path":"three"},{"path":"four"},{"path":"five"}]'::jsonb,
    '00000000-0000-4000-8000-000000002101', 'ZW', 'pickup-trucks', 'sale',
    'available', true, null
  ),
  (
    '00000000-0000-4000-8000-000000002202', 'car',
    '00000000-0000-4000-8000-000000002001', 'Recommendation Owner',
    'Private recommendation draft', 'Draft listings must never be projected.',
    10000, 'USD', 10000, 'USD', '[]'::jsonb,
    '00000000-0000-4000-8000-000000002101', 'ZW', 'sedans', 'sale',
    'draft', false, null
  ),
  (
    '00000000-0000-4000-8000-000000002203', 'car',
    '00000000-0000-4000-8000-000000002001', 'Recommendation Owner',
    'Suspended recommendation listing', 'Suspended content must never be projected.',
    12000, 'USD', 12000, 'USD', '[]'::jsonb,
    '00000000-0000-4000-8000-000000002101', 'ZW', 'sedans', 'sale',
    'available', false, now()
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
select extensions.has_table('public', 'listing_recommendation_features', 'projection table exists');
select extensions.has_table('public', 'recommendation_events', 'partitioned event table exists');
select extensions.has_table('public', 'recommendation_cache', 'cache table exists');
select extensions.has_table('public', 'recommendation_popularity_daily', 'popularity table exists');
select extensions.has_table('public', 'recommendation_weight_profiles', 'weight table exists');
select extensions.has_table('public', 'recommendation_configuration_audit', 'configuration audit table exists');
select extensions.has_table('public', 'recommendation_projection_jobs', 'projection queue exists');
select extensions.has_table('public', 'recommendation_projection_dead_letters', 'projection dead-letter table exists');

select extensions.is(
  (select count(*)::bigint from public.recommendation_projection_jobs),
  3::bigint,
  'listing and detail writes coalesce into one queued projection per listing'
);

set local role service_role;
select extensions.is(
  (select processed_count from public.process_listing_recommendation_projection_jobs(20, 8)),
  3,
  'service worker processes the queued fixture projections'
);
reset role;

select extensions.is(
  (select count(*)::bigint from public.listing_recommendation_features),
  1::bigint,
  'only the public unsuspended listing produces a projection'
);
select extensions.ok(
  (select specification_tokens @> array['toyota', 'hilux', 'diesel', 'automatic']
   from public.listing_recommendation_features
   where listing_id = '00000000-0000-4000-8000-000000002201'),
  'category-specific features are normalized'
);
select extensions.ok(
  (select quality_score >= 0.75
   from public.listing_recommendation_features
   where listing_id = '00000000-0000-4000-8000-000000002201'),
  'complete listings receive a deterministic quality score'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_weight_profiles where is_active),
  7::bigint,
  'every planned service has one active deterministic weight profile'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_weight_profiles profile
   where abs((select sum((entry.value #>> '{}')::numeric) from jsonb_each(profile.weights) entry) - 1) <= 0.000001),
  7::bigint,
  'all active weight profiles total one'
);

set local role anon;
select extensions.ok((select count(*) > 0 from public.recommendation_taxonomy_nodes), 'guest reads active taxonomy');
select extensions.is(
  (select count(*)::bigint from public.recommendation_taxonomy_nodes where stable_key = 'inactive-test-tag'),
  0::bigint,
  'guest cannot read inactive taxonomy'
);
select extensions.throws_matching(
  $$insert into public.recommendation_taxonomy_nodes (node_type, stable_key, label)
    values ('tag', 'guest-write', 'Guest write')$$,
  '.*permission denied for table recommendation_taxonomy_nodes.*',
  'guest cannot write taxonomy'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301',
    p_context => '{"surface":"listing_detail","position":1}'::jsonb
  ),
  null::uuid,
  'guest records a bounded public view'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'save',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301'
  )$$,
  '42501', 'authentication required for this event',
  'guest cannot record an authenticated-only action'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_anonymous_session_id => '00000000-0000-4000-8000-000000002301',
    p_context => '{"email":"private@example.test"}'::jsonb
  )$$,
  '22023', 'event context contains an unsupported field',
  'guest cannot submit invasive context'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_events$$,
  '.*permission denied for table recommendation_events.*',
  'guest cannot read raw events'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
set local role authenticated;
select extensions.throws_matching(
  $$select count(*) from public.listing_recommendation_features$$,
  '.*permission denied for table listing_recommendation_features.*',
  'owner cannot read internal projections directly'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_context => '{"surface":"listing_detail"}'::jsonb
  ),
  null::uuid,
  'active owner records an authenticated event'
);
select extensions.isnt(
  public.record_recommendation_event(
    p_event_type => 'search',
    p_context => '{"surface":"search","query_token_count":2,"result_count":14}'::jsonb
  ),
  null::uuid,
  'search events store counts but not query text'
);
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201',
    p_seller_id => '00000000-0000-4000-8000-000000002002'
  )$$,
  '22023', 'listing seller attribution does not match',
  'owner cannot spoof seller attribution'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  2::bigint,
  'owner reads only their own events'
);
select extensions.throws_ok(
  $$select public.admin_upsert_recommendation_taxonomy_node('tag', 'owner-tag', 'Owner tag')$$,
  '42501', 'admin access required',
  'ordinary owner cannot administer taxonomy'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  0::bigint,
  'unrelated user cannot read another account history'
);
select extensions.throws_ok(
  $$select public.admin_recommendation_configuration_snapshot()$$,
  '42501', 'admin access required',
  'unrelated user cannot read private configuration'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002004', true);
set local role authenticated;
select extensions.is(public.is_admin(), false, 'moderator-labelled account has no admin authority');
select extensions.throws_ok(
  $$select public.admin_upsert_recommendation_taxonomy_node('tag', 'moderator-tag', 'Moderator tag')$$,
  '42501', 'admin access required',
  'moderator cannot change recommendation configuration'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002003', true);
set local role authenticated;
select extensions.is(public.is_active_user(), false, 'suspended account fails the active predicate');
select extensions.throws_ok(
  $$select public.record_recommendation_event(
    p_event_type => 'view',
    p_listing_id => '00000000-0000-4000-8000-000000002201'
  )$$,
  '42501', 'active account required',
  'suspended account cannot add events'
);
select extensions.is(
  (select count(*)::bigint from public.recommendation_events),
  0::bigint,
  'suspended account cannot read behavioural history'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002005', true);
set local role authenticated;
select extensions.is(public.is_admin(), true, 'active SQL admin fixture passes the database predicate');
select extensions.isnt(
  public.admin_upsert_recommendation_taxonomy_node(
    'service', 'admin-test-service', 'Admin test service', null,
    '{"domain":"car"}'::jsonb, true
  ),
  null::uuid,
  'admin creates an audited taxonomy node'
);
select extensions.isnt(
  public.admin_upsert_recommendation_relationship(
    (select id from public.recommendation_taxonomy_nodes where node_type = 'category' and stable_key = 'car'),
    (select id from public.recommendation_taxonomy_nodes where node_type = 'service' and stable_key = 'admin-test-service'),
    'complements', 0.7, 'ADMIN_TEST_RELATIONSHIP', true
  ),
  null::uuid,
  'admin creates an audited contextual relationship'
);
select extensions.isnt(
  public.admin_upsert_recommendation_weight_profile(
    'similar-listings-service', 1, 'admin-test-v1',
    '{"category":0.5,"specifications":0.3,"quality":0.2}'::jsonb, true
  ),
  null::uuid,
  'admin activates a valid deterministic weight profile'
);
select extensions.ok(
  public.admin_recommendation_configuration_snapshot()
    ?& array['taxonomy_nodes', 'relationships', 'weight_profiles', 'generated_at'],
  'admin receives the private configuration snapshot'
);
select extensions.throws_matching(
  $$select count(*) from public.recommendation_weight_profiles$$,
  '.*permission denied for table recommendation_weight_profiles.*',
  'browser admin must use audited functions instead of direct tables'
);
select extensions.throws_matching(
  $$update public.recommendation_configuration_audit set action = 'update'$$,
  '.*permission denied for table recommendation_configuration_audit.*',
  'browser admin cannot mutate audit rows directly'
);

reset role;
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_configuration_audit
   where actor_id = '00000000-0000-4000-8000-000000002005'),
  4::bigint,
  'admin changes and automatic profile deactivation all create immutable history'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_configuration_audit
   where actor_id = '00000000-0000-4000-8000-000000002005'
     and action = 'deactivate'),
  1::bigint,
  'activating a replacement profile audits the displaced active profile'
);

set local role service_role;
select extensions.lives_ok(
  $$select public.refresh_recommendation_popularity_daily(current_date)$$,
  'service worker rebuilds one popularity day'
);
select extensions.lives_ok(
  $$select * from public.purge_expired_recommendation_data(100)$$,
  'service worker purges expired data in a bounded batch'
);
select extensions.ok(
  public.recommendation_foundation_health()
    ?& array['projection_version', 'counts_are_estimates', 'projected_public_listings', 'active_taxonomy_nodes', 'active_relationships', 'active_weight_profiles', 'generated_at'],
  'service worker reads a payload-free bounded health snapshot'
);
select extensions.throws_ok(
  $$update public.recommendation_configuration_audit set action = 'update'$$,
  '42501', 'recommendation configuration audit history is immutable',
  'trusted roles cannot rewrite audit history'
);

insert into public.recommendation_events (
  id, occurred_at, actor_id, event_type, listing_id, seller_id, context, expires_at
) values (
  '00000000-0000-4000-8000-000000002401',
  date_trunc('month', current_date + interval '12 months') + interval '1 day',
  '00000000-0000-4000-8000-000000002001',
  'view',
  '00000000-0000-4000-8000-000000002201',
  '00000000-0000-4000-8000-000000002001',
  '{"surface":"partition_test"}'::jsonb,
  date_trunc('month', current_date + interval '13 months') + interval '1 day'
);
select extensions.isnt(
  public.ensure_recommendation_event_partition((current_date + interval '12 months')::date),
  null::text,
  'service worker creates a partition even when matching rows already exist in the default partition'
);
select extensions.is(
  (select count(*)::bigint
   from public.recommendation_events
   where id = '00000000-0000-4000-8000-000000002401'),
  1::bigint,
  'late default-partition rows survive monthly partition creation'
);
reset role;

select extensions.ok(
  has_function_privilege('anon', 'public.record_recommendation_event(text,uuid,uuid,uuid,uuid,text,text,jsonb)', 'EXECUTE'),
  'guest has only bounded event ingestion'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.purge_expired_recommendation_data(integer)', 'EXECUTE'),
  'browser roles cannot run retention workers'
);
select extensions.is(
  (select count(*)::bigint
   from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relname in (
       'recommendation_taxonomy_nodes', 'recommendation_relationships',
       'listing_recommendation_features', 'recommendation_events',
       'recommendation_events_default', 'recommendation_cache',
       'recommendation_popularity_daily', 'recommendation_weight_profiles',
       'recommendation_configuration_audit', 'recommendation_projection_jobs',
       'recommendation_projection_dead_letters'
     )
     and relation.relrowsecurity),
  11::bigint,
  'all Phase 1 tables and the default partition have RLS'
);
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_similarity', 'similarity index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_seller', 'seller index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_location', 'location index exists');
select extensions.has_index('public', 'listing_recommendation_features', 'idx_listing_recommendation_recent', 'recent index exists');
select extensions.has_index('public', 'recommendation_events', 'idx_recommendation_events_actor_cursor', 'event actor cursor exists');
select extensions.has_index('public', 'recommendation_events', 'idx_recommendation_events_request_cursor', 'request cursor exists');
select extensions.has_index('public', 'recommendation_projection_jobs', 'idx_recommendation_projection_jobs_due', 'projection queue due index exists');

select * from extensions.finish();
rollback;
