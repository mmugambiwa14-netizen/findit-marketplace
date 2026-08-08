begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table(
  'private', 'abuse_rate_limit_buckets',
  'the shared abuse limiter keeps compact database-backed bucket state'
);
select extensions.has_function(
  'private', 'consume_abuse_rate_limit',
  array['text','text','integer','integer','integer'],
  'the private atomic token-consumption primitive exists'
);
select extensions.has_function(
  'public', 'prune_abuse_rate_limit_buckets', array['integer'],
  'expired limiter state has a bounded maintenance primitive'
);

select extensions.is(
  (select allowed from private.consume_abuse_rate_limit('test.atomic', 'user:test-one', 2, 604800, 1)),
  true,
  'the first token is allowed'
);
select extensions.is(
  (select allowed from private.consume_abuse_rate_limit('test.atomic', 'user:test-one', 2, 604800, 1)),
  true,
  'the second token is allowed'
);
select extensions.is(
  (select allowed from private.consume_abuse_rate_limit('test.atomic', 'user:test-one', 2, 604800, 1)),
  false,
  'the shared row denies a request after capacity is consumed'
);
select extensions.ok(
  (select retry_after_seconds > 0 from private.consume_abuse_rate_limit('test.atomic', 'user:test-one', 2, 604800, 1)),
  'a denied decision returns a positive retry horizon'
);

select extensions.matches(
  (select subject_hash from private.abuse_rate_limit_buckets where scope = 'test.atomic'),
  '^[0-9a-f]{64}$',
  'bucket subjects are persisted only as SHA-256 digests'
);
select extensions.is(
  (select count(*)::bigint
   from information_schema.columns
   where table_schema = 'private'
     and table_name = 'abuse_rate_limit_buckets'
     and column_name in ('subject', 'email', 'user_id', 'ip_address')),
  0::bigint,
  'the limiter table has no raw identity or network-identifier columns'
);

select extensions.has_trigger('public', 'inquiries', 'trg_inquiries_abuse_budget', 'message inserts are bucket-enforced');
select extensions.has_trigger('public', 'support_requests', 'trg_support_requests_abuse_budget', 'support inserts are bucket-enforced');
select extensions.has_trigger('public', 'listing_upload_intents', 'trg_listing_upload_intents_abuse_budget', 'listing image intents are bucket-enforced');
select extensions.has_trigger('public', 'marketplace_image_upload_intents', 'trg_marketplace_image_upload_intents_abuse_budget', 'marketplace image intents are bucket-enforced');
select extensions.has_trigger('public', 'listing_tour_upload_intents', 'trg_listing_tour_upload_intents_abuse_budget', 'Peek video upload intents are bucket-enforced');
select extensions.has_trigger('public', 'contact_reveal_events', 'trg_contact_reveal_events_abuse_budget', 'contact reveals are bucket-enforced');
select extensions.has_trigger('public', 'peek_requests', 'trg_peek_requests_abuse_budget', 'Peek Request creation is bucket-enforced');
select extensions.has_trigger('public', 'reports', 'trg_reports_abuse_budget', 'report creation is bucket-enforced');
select extensions.has_trigger('public', 'business_applications', 'trg_business_applications_abuse_budget', 'business applications are bucket-enforced');
select extensions.has_trigger('public', 'managed_listing_requests', 'trg_managed_listing_requests_abuse_budget', 'managed-listing requests are bucket-enforced');

-- Exercise a direct-table bypass attempt. Before this migration the 3/15m
-- support budget lived only inside submit_support_request(); direct inserts by
-- a privileged/server path could skip it. The trigger now serializes the same
-- identity independently of the caller path.
insert into public.support_requests(reference_id, contact_email, category, message)
values
  ('FIT-20260808-AAAABBBBB1', 'bucket-direct@example.test', 'other', repeat('a', 30)),
  ('FIT-20260808-AAAABBBBB2', 'bucket-direct@example.test', 'other', repeat('b', 30)),
  ('FIT-20260808-AAAABBBBB3', 'bucket-direct@example.test', 'other', repeat('c', 30));
select extensions.throws_ok(
  $$insert into public.support_requests(reference_id, contact_email, category, message)
    values ('FIT-20260808-AAAABBBBB4', 'bucket-direct@example.test', 'other', repeat('d', 30))$$,
  'P0001', 'support request rate limit exceeded; try again later',
  'the fourth direct insert cannot bypass the shared support bucket'
);

select private.consume_abuse_rate_limit('test.prune', 'user:expired', 1, 1, 1);
update private.abuse_rate_limit_buckets
set expires_at = now() - interval '1 minute'
where scope = 'test.prune';
select extensions.is(
  public.prune_abuse_rate_limit_buckets(10),
  1,
  'bounded maintenance removes one expired bucket'
);
select extensions.is(
  (select count(*)::bigint from private.abuse_rate_limit_buckets where scope = 'test.prune'),
  0::bigint,
  'pruned state is removed without touching active buckets'
);

select extensions.ok(
  has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous clients retain the established private helper schema usage boundary'
);
select extensions.ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated clients retain the established private helper schema usage boundary'
);
select extensions.is(
  has_schema_privilege('authenticated', 'private', 'CREATE'),
  false,
  'authenticated clients cannot create objects in the private schema'
);

set local role authenticated;
select extensions.throws_ok(
  $$select * from private.abuse_rate_limit_buckets$$,
  '42501', 'permission denied for table abuse_rate_limit_buckets',
  'authenticated clients have schema usage but cannot inspect hashed limiter state'
);
select extensions.throws_ok(
  $$select public.prune_abuse_rate_limit_buckets(10)$$,
  '42501', 'permission denied for function prune_abuse_rate_limit_buckets',
  'authenticated clients cannot prune limiter state'
);
reset role;

select * from extensions.finish();
rollback;
