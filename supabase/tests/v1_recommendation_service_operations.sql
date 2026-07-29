begin;
select plan(18);

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

select ok(
  (select bool_and(not enabled) from public.recommendation_service_policies),
  'operational controls do not enable services during migration'
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

select * from finish();
rollback;