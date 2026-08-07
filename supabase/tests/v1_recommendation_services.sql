begin;
select plan(29);

select has_table('public', 'recommendation_service_policies', 'service policies table exists');
select has_function('public', 'get_recommendation_service_policy_v1', array['text'], 'runtime policy function exists');
select has_function('public', 'similar_listings_service_v1', array['uuid','text','integer'], 'similar listings service exists');
select has_function('public', 'seller_recommendations_service_v1', array['uuid','text','integer'], 'seller recommendations service exists');
select has_function('public', 'related_services_service_v1', array['uuid','text','integer'], 'related services service exists');
select has_function('public', 'related_products_service_v1', array['uuid','text','integer'], 'related products service exists');
select has_function('public', 'nearby_service_v1', array['uuid','text','integer','integer'], 'nearby service exists');
select has_function('public', 'recently_listed_service_v1', array['text','integer'], 'recently listed service exists');
select has_function('public', 'personalized_recommendation_service_v1', array['uuid','text','integer'], 'personalized service exists');

select is(
  (select count(*)::integer from public.recommendation_service_policies),
  7,
  'exactly seven service policies are installed'
);

-- Migration 0059 installs the catalog with every service disabled. Migration
-- 0100_release_control_consistency.sql is the reviewed release-control
-- activation point and enables that exact catalog, refusing to apply unless
-- precisely seven policies end up enabled. Certify the authoritative
-- post-activation state, not the pre-activation one.
select is(
  (select count(*)::integer from public.recommendation_service_policies where enabled),
  7,
  'the reviewed release control leaves the exact seven-service catalog enabled'
);

select ok(
  (select bool_and(contract_version = 1) from public.recommendation_service_policies),
  'all services start on contract version one'
);

select ok(
  (select bool_and(maximum_page_size between 1 and 100) from public.recommendation_service_policies),
  'all service page limits are bounded'
);

select ok(
  (select bool_and(timeout_ms between 50 and 5000) from public.recommendation_service_policies),
  'all service timeouts are bounded'
);

select ok(
  (select bool_and(cache_stale_seconds >= cache_fresh_seconds) from public.recommendation_service_policies),
  'all stale cache windows contain the fresh window'
);

set local role anon;
select throws_ok(
  $$select public.get_recommendation_service_policy_v1('similar_listings_service')$$,
  '42501',
  null,
  'anonymous callers cannot read runtime policy'
);
select throws_ok(
  $$select public.similar_listings_service_v1(gen_random_uuid(), null, 12)$$,
  '42501',
  null,
  'anonymous callers cannot execute similar listing service database API'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.personalized_recommendation_service_v1(gen_random_uuid(), null, 12)$$,
  '42501',
  null,
  'authenticated browser callers cannot execute personalized database API directly'
);
reset role;

set local role service_role;
select is(
  (public.get_recommendation_service_policy_v1('similar_listings_service')->>'enabled')::boolean,
  true,
  'service role reads the activated runtime policy'
);
-- An enabled service still refuses to answer for a subject that is not in the
-- eligibility projection, and returns no items when it does so.
select is(
  public.similar_listings_service_v1(gen_random_uuid(), null, 500)->>'reason',
  'subject_not_eligible',
  'an enabled service refuses an ineligible subject instead of guessing'
);
select is(
  jsonb_array_length(public.similar_listings_service_v1(gen_random_uuid(), null, 500)->'items'),
  0,
  'an ineligible subject yields no recommendation items'
);
select is(
  jsonb_array_length(public.recently_listed_service_v1(null, 500)->'items'),
  0,
  'the global service yields no items while no listing is eligible'
);
-- Personalization stays opt-in: with no enabled preference row for the viewer
-- the service returns before it touches recommendation_events at all.
select is(
  public.personalized_recommendation_service_v1(gen_random_uuid(), null, 12)->>'reason',
  'personalization_not_enabled',
  'personalization stays opt-in and returns without event access'
);
reset role;

-- The disabled degradation path is still a live control, so keep proving it.
-- Switching a policy off is a fixture mutation performed as the test role; the
-- runtime service role deliberately cannot do this (asserted below).
update public.recommendation_service_policies
set enabled = false
where service_name in ('similar_listings_service', 'personalized_recommendation_service');

set local role service_role;
select is(
  (public.get_recommendation_service_policy_v1('similar_listings_service')->>'enabled')::boolean,
  false,
  'runtime policy reports a service that has been switched off'
);
select is(
  public.similar_listings_service_v1(gen_random_uuid(), null, 500)->>'reason',
  'service_disabled',
  'a disabled service degrades before any subject lookup'
);
select is(
  public.personalized_recommendation_service_v1(gen_random_uuid(), null, 12)->>'reason',
  'service_disabled',
  'a disabled personalized service degrades before any event access'
);
reset role;

update public.recommendation_service_policies
set enabled = true
where service_name in ('similar_listings_service', 'personalized_recommendation_service');

select ok(
  not has_function_privilege('service_role', 'public.recommendation_service_v1(text,uuid,uuid,text,integer,integer)', 'EXECUTE'),
  'shared dispatcher is not executable by service role'
);

select ok(
  not has_table_privilege('service_role', 'public.recommendation_service_policies', 'UPDATE'),
  'runtime service role cannot mutate service policy'
);

select ok(
  has_table_privilege('service_role', 'public.recommendation_cache', 'SELECT')
  and has_table_privilege('service_role', 'public.recommendation_cache', 'INSERT')
  and has_table_privilege('service_role', 'public.recommendation_cache', 'UPDATE'),
  'service role can operate disposable recommendation cache'
);

select * from finish();
rollback;
