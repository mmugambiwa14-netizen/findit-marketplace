begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_function('private', 'enforce_listing_owner_abuse_budget', array[]::text[], 'listing owner abuse trigger function exists');
select extensions.has_function('private', 'enforce_service_owner_abuse_budget', array[]::text[], 'service owner abuse trigger function exists');
select extensions.has_function('private', 'enforce_peek_support_abuse_budget', array[]::text[], 'Peek support abuse trigger function exists');
select extensions.has_function('private', 'enforce_profile_owner_abuse_budget', array[]::text[], 'profile owner abuse trigger function exists');

select extensions.has_trigger('public', 'listings', 'trg_listings_owner_abuse_budget', 'listing owner writes are bucket-enforced');
select extensions.has_trigger('public', 'services', 'trg_services_owner_abuse_budget', 'service owner writes are bucket-enforced');
select extensions.has_trigger('public', 'peek_request_supporters', 'trg_peek_request_supporters_abuse_budget', 'Peek support inserts are bucket-enforced');
select extensions.has_trigger('public', 'users', 'trg_users_owner_abuse_budget', 'profile owner updates are bucket-enforced');

select extensions.ok(
  (select prosecdef from pg_proc where oid = 'private.enforce_listing_owner_abuse_budget()'::regprocedure),
  'listing limiter trigger is SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid = 'private.enforce_service_owner_abuse_budget()'::regprocedure),
  'service limiter trigger is SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid = 'private.enforce_peek_support_abuse_budget()'::regprocedure),
  'Peek support limiter trigger is SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid = 'private.enforce_profile_owner_abuse_budget()'::regprocedure),
  'profile limiter trigger is SECURITY DEFINER'
);

select extensions.is(
  has_function_privilege('anon', 'private.enforce_listing_owner_abuse_budget()', 'EXECUTE'),
  false,
  'anon cannot execute listing limiter internals directly'
);
select extensions.is(
  has_function_privilege('authenticated', 'private.enforce_listing_owner_abuse_budget()', 'EXECUTE'),
  false,
  'authenticated cannot execute listing limiter internals directly'
);
select extensions.is(
  has_function_privilege('service_role', 'private.enforce_listing_owner_abuse_budget()', 'EXECUTE'),
  false,
  'service role cannot execute listing limiter internals directly'
);
select extensions.is(
  has_function_privilege('authenticated', 'private.enforce_service_owner_abuse_budget()', 'EXECUTE'),
  false,
  'authenticated cannot execute service limiter internals directly'
);
select extensions.is(
  has_function_privilege('authenticated', 'private.enforce_peek_support_abuse_budget()', 'EXECUTE'),
  false,
  'authenticated cannot execute Peek support limiter internals directly'
);
select extensions.is(
  has_function_privilege('authenticated', 'private.enforce_profile_owner_abuse_budget()', 'EXECUTE'),
  false,
  'authenticated cannot execute profile limiter internals directly'
);

select extensions.ok(
  coalesce((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.enforce_listing_owner_abuse_budget()'::regprocedure), false),
  'listing limiter pins an empty search_path'
);
select extensions.ok(
  coalesce((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.enforce_service_owner_abuse_budget()'::regprocedure), false),
  'service limiter pins an empty search_path'
);
select extensions.ok(
  coalesce((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.enforce_peek_support_abuse_budget()'::regprocedure), false),
  'Peek support limiter pins an empty search_path'
);
select extensions.ok(
  coalesce((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.enforce_profile_owner_abuse_budget()'::regprocedure), false),
  'profile limiter pins an empty search_path'
);

select * from extensions.finish();
rollback;
