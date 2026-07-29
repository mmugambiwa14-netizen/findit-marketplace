begin;
select plan(24);

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

select is(
  (select count(*)::integer from public.recommendation_service_policies where enabled),
  0,
  'all recommendation services are disabled by default'
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
  false,
  'service role can read disabled policy'
);
select is(
  public.similar_listings_service_v1(gen_random_uuid(), null, 500)->>'reason',
  'service_disabled',
  'disabled service returns a degraded response before subject lookup'
);
select is(
  jsonb_array_length(public.recently_listed_service_v1(null, 500)->'items'),
  0,
  'disabled global service returns no items'
);
select is(
  public.personalized_recommendation_service_v1(gen_random_uuid(), null, 12)->>'reason',
  'service_disabled',
  'disabled personalized service returns safely without event access'
);
reset role;

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
