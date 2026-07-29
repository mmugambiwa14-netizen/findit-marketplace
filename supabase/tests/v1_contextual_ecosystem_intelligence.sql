begin;
select plan(20);

select has_table('public', 'recommendation_contexts', 'context catalogue exists');
select has_table('public', 'recommendation_context_rules', 'context rule table exists');
select has_function('public', 'contextual_ecosystem_plan_v1', array['uuid','text','integer'], 'context plan function exists');
select has_function(
  'public',
  'admin_upsert_recommendation_context_rule_v1',
  array['text','uuid','text','text','integer','integer','jsonb','boolean','timestamp with time zone','timestamp with time zone'],
  'audited context rule admin function exists'
);

select is((select count(*)::integer from public.recommendation_contexts where is_active), 5, 'five initial journey contexts are active');
select is((select count(*)::integer from public.recommendation_context_rules where is_active), 6, 'six initial orchestration rules are active');
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

select * from finish();
rollback;
