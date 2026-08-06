begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000009001', 'support-admin@example.test', '{"full_name":"Support Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000009002', 'support-user@example.test', '{"full_name":"Support User"}', now(), now());

update public.users set role = 'admin'
where id = '00000000-0000-4000-8000-000000009001';

set local role anon;
select extensions.throws_ok(
  $$select * from public.support_requests$$,
  '42501', 'permission denied for table support_requests',
  'guests cannot read the founder inbox table'
);
select extensions.throws_ok(
  $$select public.submit_support_request('payments', 'guest@example.test', repeat('x', 30), null)$$,
  '22023', 'invalid support category',
  'submission rejects categories outside the V1 contract'
);
select extensions.lives_ok(
  $$select public.submit_support_request(
      'safety', 'guest@example.test',
      'A marketplace advert appears unsafe and needs review.', 'listing-123'
    )$$,
  'a guest can submit one bounded support request'
);

reset role;
select extensions.matches(
  (select reference_id from public.support_requests where contact_email = 'guest@example.test'),
  '^FIT-[0-9]{8}-[A-F0-9]{10}$',
  'the request receives an opaque human-readable reference'
);

set local role anon;
select public.submit_support_request('other', 'limited@example.test', repeat('a', 30), null);
select public.submit_support_request('other', 'limited@example.test', repeat('b', 30), null);
select public.submit_support_request('other', 'limited@example.test', repeat('c', 30), null);
select extensions.throws_ok(
  $$select public.submit_support_request('other', 'limited@example.test', repeat('d', 30), null)$$,
  'P0001', 'support request rate limit exceeded; try again later',
  'the fourth request for one email inside fifteen minutes is rejected'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
-- 20260805033000 retired the offset admin RPCs, so the founder inbox is served
-- by the keyset page function. The legacy entrypoint must stay unreachable, and
-- the live one must still refuse a caller who is not an admin.
set local role authenticated;
select extensions.throws_ok(
  $$select * from public.admin_support_request_rows('', 'all', 'all', 25, 0)$$,
  '42501', 'permission denied for function admin_support_request_rows',
  'the retired offset founder inbox entrypoint is no longer callable'
);
select extensions.throws_ok(
  $$select * from public.admin_support_request_rows_page('', 'all', 'all', 25, null, null)$$,
  '42501', 'admin access required',
  'ordinary users cannot read the founder inbox projection'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.admin_support_request_rows_page('guest@example.test', 'open', 'safety', 25, null, null)),
  1::bigint,
  'admin support search returns the matching open request'
);
select extensions.is(
  (select count(*)::bigint from public.admin_support_request_rows_page('', 'open', 'all', 25, null, null)),
  4::bigint,
  'the founder inbox returns every open request on the first page'
);
select extensions.lives_ok(
  $$select public.admin_resolve_support_request(
      (select request_id from public.admin_support_request_rows_page('guest@example.test', 'open', 'safety', 1, null, null)),
      'Reviewed the safety concern and recorded the outcome'
    )$$,
  'an admin can resolve a request with an auditable note'
);

reset role;
select extensions.is(
  (select status from public.support_requests where contact_email = 'guest@example.test'),
  'resolved',
  'the resolution persists'
);
select extensions.is(
  (select count(*)::bigint from public.audit_logs
   where target_record_type = 'support_request'
     and action_performed = 'support_request.resolved'
     and before_values ? 'contact_email' = false
     and after_values ? 'message' = false),
  1::bigint,
  'the privileged resolution is audited without copying sensitive request content'
);

select * from extensions.finish();
rollback;
