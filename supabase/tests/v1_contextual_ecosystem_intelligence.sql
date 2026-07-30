begin;
select plan(43);

select has_table('public', 'recommendation_contexts', 'context catalogue exists');
select has_table('public', 'recommendation_context_rules', 'context rule table exists');
select has_function('public', 'contextual_ecosystem_plan_v1', array['uuid','text','integer'], 'context plan function exists');
select has_function(
  'public',
  'admin_upsert_recommendation_context_rule_v1',
  array['text','uuid','text','text','integer','integer','jsonb','boolean','timestamp with time zone','timestamp with time zone'],
  'audited context rule admin function exists'
);

select is((select count(*)::integer from public.recommendation_contexts where is_active), 6, 'six journey contexts are active');
select is((select count(*)::integer from public.recommendation_context_rules where is_active), 7, 'seven orchestration rules are active');
select ok(
  exists (
    select 1
    from public.recommendation_contexts context
    join public.recommendation_context_rules rule on rule.context_id = context.id
    where context.stable_key = 'listing_support'
      and context.journey_stage = 'evaluate'
      and context.is_active
      and rule.service_name = 'related_services_service'
      and rule.reason_code = 'services_for_listing'
      and rule.is_active
  ),
  'listing detail evaluation includes the related-services service'
);
select ok((select bool_and(maximum_items between 1 and 24) from public.recommendation_context_rules), 'all section item limits are bounded');
select ok((select bool_and(reason_code ~ '^[a-z][a-z0-9_]{2,63}$') from public.recommendation_context_rules), 'all contextual reasons are stable machine codes');
select ok(not exists(select 1 from public.recommendation_context_rules where service_name = 'personalized_recommendation_service'), 'Phase 3 does not introduce personalization');
select ok(not exists(select 1 from public.recommendation_context_rules where service_name not in (
  'similar_listings_service','seller_recommendations_service','related_services_service',
  'related_products_service','nearby_service','recently_listed_service'
)), 'rules only orchestrate existing independent services');

set local role anon;
select throws_ok(
  $$select public.contextual_ecosystem_plan_v1(gen_random_uuid(), null, 6)$$,
  '42501', null, 'anonymous callers cannot execute database orchestration directly'
);
select throws_ok(
  $$select * from public.recommendation_contexts$$,
  '42501', null, 'anonymous callers cannot read context configuration'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.contextual_ecosystem_plan_v1(gen_random_uuid(), null, 6)$$,
  '42501', null, 'authenticated browser callers cannot execute database orchestration directly'
);
select throws_ok(
  $$select public.admin_upsert_recommendation_context_rule_v1('compare_options', null, 'similar_listings_service', 'test_reason', 10, 6, '{}'::jsonb, true, now(), null)$$,
  '42501', null, 'non-admin authenticated callers cannot change context rules'
);
reset role;

set local role service_role;
select is(
  public.contextual_ecosystem_plan_v1(gen_random_uuid(), null, 6)->>'reason',
  'subject_not_eligible',
  'ineligible subject returns an empty non-error plan'
);
select is(
  jsonb_array_length(public.contextual_ecosystem_plan_v1(gen_random_uuid(), null, 6)->'sections'),
  0,
  'ineligible subject has no sections'
);
select throws_ok(
  $$select public.contextual_ecosystem_plan_v1(gen_random_uuid(), 'invalid', 6)$$,
  '22023', 'invalid journey stage', 'invalid journey stage is rejected'
);
reset role;

select ok(
  not has_table_privilege('service_role', 'public.recommendation_contexts', 'INSERT')
  and not has_table_privilege('service_role', 'public.recommendation_context_rules', 'UPDATE'),
  'runtime service role cannot mutate contextual configuration'
);
select ok(
  has_function_privilege('service_role', 'public.contextual_ecosystem_plan_v1(uuid,text,integer)', 'EXECUTE'),
  'service role can execute contextual plan'
);
select ok(
  not has_function_privilege('anon', 'public.contextual_ecosystem_plan_v1(uuid,text,integer)', 'EXECUTE'),
  'anonymous role cannot execute contextual plan'
);
select ok(
  (select count(*) = count(distinct (context_id, coalesce(source_node_id, '00000000-0000-0000-0000-000000000000'::uuid), service_name, reason_code))
   from public.recommendation_context_rules),
  'global and taxonomy-scoped rule identities are unique'
);

-- Phase 3 completion: validated condition vocabulary, precedence, service
-- availability awareness and operational health.

select has_function('public', 'contextual_condition_keys_v1', 'closed condition vocabulary exists');
select has_function('public', 'contextual_conditions_valid_v1', array['jsonb'], 'condition validator exists');
select has_function('public', 'contextual_ecosystem_health_v1', 'contextual operational health exists');

select ok(public.contextual_conditions_valid_v1('{}'::jsonb), 'an empty condition set is valid');
select ok(
  public.contextual_conditions_valid_v1('{"requires_location": true, "requires_price": false}'::jsonb),
  'boolean state conditions are accepted'
);
select ok(
  public.contextual_conditions_valid_v1('{"minimum_quality_score": 0.5}'::jsonb),
  'an in-range quality threshold is accepted'
);
select ok(
  public.contextual_conditions_valid_v1('{"listing_statuses": ["available", "under_offer"]}'::jsonb),
  'known listing statuses are accepted'
);
select ok(
  not public.contextual_conditions_valid_v1('{"unknown_condition": true}'::jsonb),
  'an unknown condition key is rejected rather than silently ignored'
);
select ok(
  not public.contextual_conditions_valid_v1('{"requires_location": "yes"}'::jsonb),
  'a mistyped state condition is rejected'
);
select ok(
  not public.contextual_conditions_valid_v1('{"minimum_quality_score": 2}'::jsonb),
  'an out-of-range quality threshold is rejected'
);
select ok(
  not public.contextual_conditions_valid_v1('{"listing_statuses": ["deleted"]}'::jsonb),
  'an unpublishable listing status is rejected'
);
select ok(
  not public.contextual_conditions_valid_v1('[]'::jsonb),
  'a non-object condition set is rejected'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'recommendation_context_rules_conditions_vocabulary'
      and conrelid = 'public.recommendation_context_rules'::regclass
  ),
  'the condition vocabulary is enforced by a table constraint'
);

select is(
  (public.contextual_ecosystem_plan_v1(gen_random_uuid(), null, 6) ->> 'contractVersion'),
  '2',
  'the completed plan advertises contract version 2'
);

select is(
  (public.contextual_ecosystem_health_v1() ->> 'contractVersion'),
  '1',
  'contextual health advertises its own contract version'
);
select ok(
  public.contextual_ecosystem_health_v1() ? 'activeContexts'
  and public.contextual_ecosystem_health_v1() ? 'activeRules'
  and public.contextual_ecosystem_health_v1() ? 'rulesReferencingDisabledServices',
  'contextual health reports operational counts'
);
select ok(
  not (public.contextual_ecosystem_health_v1()::text ~* 'listing_id|seller_id|actor_id|email|viewer'),
  'contextual health contains no customer or identity data'
);
select is(
  (public.contextual_ecosystem_health_v1() ->> 'activeContexts'),
  '6',
  'contextual health counts the active contexts'
);

-- Every seeded rule targets a service that is disabled by default, so a plan can
-- never advertise a section whose service would refuse to answer.
select is(
  (public.contextual_ecosystem_health_v1() ->> 'rulesReferencingDisabledServices'),
  '7',
  'rules are reported against their disabled services'
);

select ok(
  not has_function_privilege('anon', 'public.contextual_ecosystem_health_v1()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.contextual_ecosystem_health_v1()', 'EXECUTE'),
  'browser roles cannot read contextual operational health'
);
select ok(
  has_function_privilege('service_role', 'public.contextual_ecosystem_health_v1()', 'EXECUTE'),
  'service role can read contextual operational health'
);

select * from finish();
rollback;
