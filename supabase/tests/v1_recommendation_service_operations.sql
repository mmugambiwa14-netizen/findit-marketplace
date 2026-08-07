begin;
select plan(37);

select has_column('public', 'recommendation_service_policies', 'id', 'service policies have stable audit identities');
select col_is_pk('public', 'recommendation_service_policies', 'service_name', 'service name remains authoritative primary key');
select ok(
  (select count(distinct id) = 7 and count(*) = 7 from public.recommendation_service_policies),
  'all service policies have unique durable audit identities'
);

select has_function(
  'public',
  'admin_update_recommendation_service_policy_v1',
  array['text','boolean','integer','integer','integer','integer','jsonb'],
  'audited service policy admin contract exists'
);
select has_function(
  'public',
  'admin_purge_recommendation_service_cache_v1',
  array['text','uuid','integer'],
  'bounded cache purge contract exists'
);
select has_function(
  'public',
  'recommendation_services_health_v1',
  array[]::text[],
  'privacy-safe service health contract exists'
);

select ok(
  not has_function_privilege('anon', 'public.admin_update_recommendation_service_policy_v1(text,boolean,integer,integer,integer,integer,jsonb)', 'EXECUTE'),
  'anonymous callers cannot mutate service policy'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_update_recommendation_service_policy_v1(text,boolean,integer,integer,integer,integer,jsonb)', 'EXECUTE'),
  'authenticated role can reach the admin-guarded policy contract'
);
select ok(
  not has_function_privilege('service_role', 'public.admin_update_recommendation_service_policy_v1(text,boolean,integer,integer,integer,integer,jsonb)', 'EXECUTE'),
  'runtime service role cannot mutate service policy'
);
select ok(
  not has_function_privilege('authenticated', 'public.recommendation_services_health_v1()', 'EXECUTE'),
  'browser callers cannot read internal service health'
);
select ok(
  has_function_privilege('service_role', 'public.recommendation_services_health_v1()', 'EXECUTE'),
  'service role can read internal service health'
);

set local role authenticated;
select throws_ok(
  $$select public.admin_update_recommendation_service_policy_v1(
    'similar_listings_service', true, 250, 30, 300, 24, '{}'::jsonb
  )$$,
  '42501',
  null,
  'non-admin authenticated users cannot enable services'
);
select throws_ok(
  $$select public.admin_purge_recommendation_service_cache_v1(
    'similar_listings_service', null, 100
  )$$,
  '42501',
  null,
  'non-admin authenticated users cannot purge cache'
);
reset role;

set local role service_role;
select is(
  jsonb_array_length(public.recommendation_services_health_v1()->'services'),
  7,
  'health output contains exactly seven services'
);
select ok(
  not (public.recommendation_services_health_v1()::text ~* 'actor|anonymous_session|email|phone|message'),
  'health output contains no customer identity or behavioural fields'
);
reset role;

-- Migration 0100_release_control_consistency.sql is the reviewed release-control
-- activation point: it enables the seven-service catalog and records that fact
-- on the recommendation_foundation control. The pre-activation expectation that
-- every policy stays disabled is therefore obsolete. Certify instead that the
-- operational-control metadata and the authoritative policy table still agree,
-- so neither can silently drift away from the other.
select ok(
  (select (configuration->>'service_policy_source') = 'recommendation_service_policies'
      and (configuration->'services_enabled') = 'true'::jsonb
      and (configuration->>'active_service_policy_count')::integer
          = (select count(*)::integer from public.recommendation_service_policies where enabled)
     from public.marketplace_operational_controls
    where control_key = 'recommendation_foundation'),
  'operational control metadata agrees with the authoritative service policy table'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recommendation_configuration_audit'::regclass
      and pg_get_constraintdef(oid) like '%service_policy%'
  ),
  'configuration audit accepts service policy evidence'
);
select ok(
  (select (configuration->>'schema_version')::integer >= 62
     from public.marketplace_operational_controls
    where control_key = 'recommendation_foundation'),
  'operational control records migration 62 or a later certification correction'
);

-- 0067: durable circuit-breaker state and bounded abuse controls.

select has_table('public', 'recommendation_service_circuit_state', 'durable circuit state table exists');
select has_table('public', 'recommendation_request_budget', 'request budget table exists');
select has_function('public', 'recommendation_service_runtime_state_v1', array['text'], 'combined policy and circuit read exists');
select has_function('public', 'record_recommendation_service_outcome_v1', array['text','boolean','integer','integer'], 'durable outcome recorder exists');
select has_function('public', 'consume_recommendation_request_budget_v1', array['text','text','integer','integer'], 'request budget consumer exists');
select has_function('public', 'purge_recommendation_request_budget_v1', array['integer'], 'bounded budget purge exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.recommendation_service_circuit_state'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.recommendation_request_budget'::regclass),
  'abuse and circuit tables enforce row level security'
);
select ok(
  not has_table_privilege('anon', 'public.recommendation_request_budget', 'SELECT')
  and not has_table_privilege('authenticated', 'public.recommendation_request_budget', 'SELECT')
  and not has_table_privilege('service_role', 'public.recommendation_request_budget', 'SELECT'),
  'no role reads the request budget directly'
);
select ok(
  not has_function_privilege('anon', 'public.consume_recommendation_request_budget_v1(text,text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_recommendation_service_outcome_v1(text,boolean,integer,integer)', 'EXECUTE'),
  'browser roles cannot drive the breaker or spend request budget'
);

select is(
  (select count(*)::integer from public.recommendation_service_circuit_state),
  (select count(*)::integer from public.recommendation_service_policies),
  'every service has durable circuit state'
);

-- The runtime state contract must carry both the policy and the breaker, or the
-- Edge runtime would need a second round trip on every request.
select ok(
  public.recommendation_service_runtime_state_v1('similar_listings_service') ? 'circuitOpen'
  and public.recommendation_service_runtime_state_v1('similar_listings_service') ? 'timeoutMs'
  and public.recommendation_service_runtime_state_v1('similar_listings_service') ? 'requestBudgetPerWindow',
  'runtime state carries policy, circuit and budget together'
);
select is(
  (public.recommendation_service_runtime_state_v1('similar_listings_service') ->> 'circuitOpen'),
  'false',
  'a healthy service reports a closed circuit'
);

-- Three consecutive failures must open the breaker durably, and one success must
-- close it again.
select ok(
  not public.record_recommendation_service_outcome_v1('similar_listings_service', false, 3, 30)
  and not public.record_recommendation_service_outcome_v1('similar_listings_service', false, 3, 30)
  and public.record_recommendation_service_outcome_v1('similar_listings_service', false, 3, 30),
  'the breaker opens on the configured consecutive failure threshold'
);
select is(
  (public.recommendation_service_runtime_state_v1('similar_listings_service') ->> 'circuitOpen'),
  'true',
  'an opened breaker is visible to every isolate through the database'
);
select ok(
  public.record_recommendation_service_outcome_v1('similar_listings_service', true),
  'a success is recorded'
);
select is(
  (public.recommendation_service_runtime_state_v1('similar_listings_service') ->> 'circuitOpen'),
  'false',
  'a success closes the breaker again'
);
select ok(
  not public.record_recommendation_service_outcome_v1('not_a_service', false),
  'an unknown service name is refused rather than recorded'
);

-- Budget is consumed per window and fails open on a malformed client hash.
select ok(
  public.consume_recommendation_request_budget_v1(repeat('a', 64), 'similar_listings_service', 2, 60)
  and public.consume_recommendation_request_budget_v1(repeat('a', 64), 'similar_listings_service', 2, 60)
  and not public.consume_recommendation_request_budget_v1(repeat('a', 64), 'similar_listings_service', 2, 60),
  'requests beyond the window budget are refused'
);
select ok(
  public.consume_recommendation_request_budget_v1('not-a-hash', 'similar_listings_service', 1, 60),
  'a malformed client hash fails open rather than removing sections'
);

select * from finish();
rollback;