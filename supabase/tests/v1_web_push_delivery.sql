begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('94000000-0000-4000-8000-000000000001', 'web-push-owner@example.test', '{"full_name":"Web Push Owner"}', now(), now()),
  ('94000000-0000-4000-8000-000000000002', 'web-push-other@example.test', '{"full_name":"Web Push Other"}', now(), now());

set local role service_role;
insert into public.web_push_subscriptions (
  id, user_id, endpoint, p256dh, auth, user_agent, platform
)
values
  ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'https://push.example.test/device-owner-1', repeat('a', 87), repeat('b', 43), 'test-browser-1', 'web-pwa'),
  ('94000000-0000-4000-8000-000000000102', '94000000-0000-4000-8000-000000000001', 'https://push.example.test/device-owner-2', repeat('c', 87), repeat('d', 43), 'test-browser-2', 'android-pwa'),
  ('94000000-0000-4000-8000-000000000103', '94000000-0000-4000-8000-000000000002', 'https://push.example.test/device-other-1', repeat('e', 87), repeat('f', 43), 'test-browser-3', 'web-pwa');
reset role;

select extensions.ok(
  relrowsecurity
  and not has_table_privilege('anon', 'public.web_push_subscriptions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.web_push_subscriptions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.web_push_delivery_attempts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_preferences', 'SELECT'),
  'push secrets, delivery attempts and preferences are RLS protected and not directly exposed'
)
from pg_class
where oid = 'public.web_push_subscriptions'::regclass;

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_notification_preferences()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_notification_preferences(boolean,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_notification_preferences()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_notification_preferences(boolean,boolean)', 'EXECUTE'),
  'authenticated users receive only the notification preference RPC boundary'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.claim_web_push_delivery_attempts(integer,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_web_push_delivery_attempt(bigint,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.fail_web_push_delivery_attempt(bigint,uuid,text,boolean)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.retire_web_push_subscription(uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_web_push_delivery_attempts(integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_web_push_delivery_attempt(bigint,uuid)', 'EXECUTE'),
  'only the trusted worker can claim or finalize delivery attempts'
);

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.is(
  (select push_enabled from public.get_notification_preferences()),
  true,
  'new users receive push notifications enabled by default'
);
select extensions.is(
  (select in_app_sound_enabled from public.get_notification_preferences()),
  true,
  'new users receive in-app notification sound enabled by default'
);
select extensions.is(
  (select in_app_sound_enabled from public.update_notification_preferences(null, false)),
  false,
  'users can change only the in-app sound preference'
);
select extensions.is(
  (select push_enabled from public.update_notification_preferences(false, null)),
  false,
  'users can disable push delivery without changing sound'
);

reset role;
set local role service_role;
insert into public.app_alerts (
  id, user_id, title, message, type, link, event_type, source_key
)
values (
  '94000000-0000-4000-8000-000000000201',
  '94000000-0000-4000-8000-000000000001',
  'Disabled push alert', 'This alert must not create delivery work.', 'system', '/settings', 'account_status', 'web-push-disabled'
);
select extensions.is(
  (select count(*)::bigint from public.web_push_delivery_jobs where alert_id = '94000000-0000-4000-8000-000000000201'),
  0::bigint,
  'disabled push preference suppresses new delivery jobs'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.update_notification_preferences(true, true)$$,
  're-enabling push and sound succeeds through the authenticated wrapper'
);
select extensions.lives_ok(
  $$select public.register_web_push_subscription('https://push.example.test/device-owner-1', repeat('z', 87), repeat('y', 43), 'renewed-browser', 'web-pwa')$$,
  'same-account subscription renewal updates keys without creating a second endpoint'
);
select extensions.throws_ok(
  $$select public.register_web_push_subscription('https://push.example.test/device-other-1', repeat('z', 87), repeat('y', 43), 'takeover', 'web-pwa')$$,
  '42501', null,
  'one account cannot take over another account push endpoint'
);

reset role;
set local role service_role;
insert into public.app_alerts (
  id, user_id, title, message, type, link, event_type, source_key
)
values (
  '94000000-0000-4000-8000-000000000202',
  '94000000-0000-4000-8000-000000000001',
  'New message', 'You have a new message in PeekaListing.', 'status_change', '/chats/94000000-0000-4000-8000-000000000301', 'message_received', 'web-push-message'
);

select extensions.is(
  (select count(*)::bigint from public.web_push_delivery_jobs where alert_id = '94000000-0000-4000-8000-000000000202'),
  1::bigint,
  'a canonical alert produces one durable delivery job'
);
select extensions.is(
  (select count(*)::bigint from public.web_push_delivery_attempts a join public.web_push_delivery_jobs j on j.id = a.job_id where j.alert_id = '94000000-0000-4000-8000-000000000202'),
  2::bigint,
  'one canonical alert produces one delivery attempt per active device'
);

reset role;
set local role authenticated;
select extensions.throws_ok(
  $$select * from public.claim_web_push_delivery_attempts(10, 120)$$,
  '42501', null,
  'authenticated clients cannot claim push delivery work'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
create temporary table web_push_claims on commit drop as
select * from public.claim_web_push_delivery_attempts(10, 120);
select extensions.is((select count(*)::bigint from web_push_claims), 2::bigint, 'trusted claim returns every active device attempt');
select extensions.is((select count(*)::bigint from web_push_claims where lease_token is not null), 2::bigint, 'every claimed attempt has a lease token');
select extensions.is((select count(*)::bigint from public.web_push_delivery_attempts where status = 'processing'), 2::bigint, 'claim atomically marks attempts as processing');

select extensions.is(
  public.complete_web_push_delivery_attempt(
    (select attempt_id from web_push_claims order by attempt_id limit 1),
    (select lease_token from web_push_claims order by attempt_id limit 1)
  ),
  true,
  'a worker can finalize a successful attempt with its lease'
);
select extensions.is(
  public.fail_web_push_delivery_attempt(
    (select attempt_id from web_push_claims order by attempt_id desc limit 1),
    (select lease_token from web_push_claims order by attempt_id desc limit 1),
    'provider_timeout', true
  ),
  true,
  'a transient provider failure is retryable'
);
select extensions.is(
  (select status from public.web_push_delivery_jobs where alert_id = '94000000-0000-4000-8000-000000000202'),
  'partial',
  'the aggregate job records partial delivery when one device succeeds'
);

do $test$
declare
  v_claim record;
  v_round integer;
begin
  for v_round in 1..4 loop
    update public.web_push_delivery_attempts
    set available_at = now()
    where status = 'failed';
    for v_claim in select * from public.claim_web_push_delivery_attempts(10, 120) loop
      perform public.fail_web_push_delivery_attempt(v_claim.attempt_id, v_claim.lease_token, 'provider_timeout', true);
    end loop;
  end loop;
end
$test$;

select extensions.is(
  (select attempts from public.web_push_delivery_attempts where id = (select attempt_id from web_push_claims order by attempt_id desc limit 1)),
  5,
  'delivery retry attempts are bounded at five'
);
select extensions.is(
  (select status from public.web_push_delivery_attempts where id = (select attempt_id from web_push_claims order by attempt_id desc limit 1)),
  'abandoned',
  'the fifth retry becomes a terminal abandoned attempt'
);
select extensions.is(
  (select status from public.web_push_delivery_jobs where alert_id = '94000000-0000-4000-8000-000000000202'),
  'partial',
  'a terminal device attempt leaves the aggregate job in a truthful terminal state'
);

insert into public.app_alerts (
  id, user_id, title, message, type, link, event_type, source_key
)
values (
  '94000000-0000-4000-8000-000000000203',
  '94000000-0000-4000-8000-000000000002',
  'Other account update', 'A second account update.', 'system', '/settings', 'account_status', 'web-push-other'
);
select extensions.is(
  (select count(*)::bigint from public.web_push_delivery_attempts a join public.web_push_delivery_jobs j on j.id = a.job_id where j.alert_id = '94000000-0000-4000-8000-000000000203'),
  1::bigint,
  'the second account receives one device attempt'
);
reset role;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.disable_web_push_subscription('https://push.example.test/device-other-1')$$,
  'a user can disable one device subscription through the authenticated boundary'
);
reset role;
select extensions.is(
  (select status from public.web_push_delivery_jobs where alert_id = '94000000-0000-4000-8000-000000000203'),
  'abandoned',
  'disabling the final device refreshes the aggregate job to abandoned'
);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.register_web_push_subscription('https://push.example.test/device-other-1', repeat('e', 87), repeat('f', 43), 're-enabled-browser', 'web-pwa')$$,
  'a disabled device can renew its subscription'
);
reset role;
set local role service_role;
insert into public.app_alerts (
  id, user_id, title, message, type, link, event_type, source_key
)
values (
  '94000000-0000-4000-8000-000000000204',
  '94000000-0000-4000-8000-000000000002',
  'Other account update 2', 'A second account update.', 'system', '/settings', 'account_status', 'web-push-other-2'
);
create temporary table web_push_other_claim on commit drop as
select * from public.claim_web_push_delivery_attempts(10, 120);
select extensions.is((select count(*)::bigint from web_push_other_claim), 1::bigint, 'another account receives its own device attempt');
select extensions.is(
  public.retire_web_push_subscription((select subscription_id from web_push_other_claim limit 1), 'push_410'),
  true,
  'invalid push endpoints can be retired by the trusted worker'
);
select extensions.is(
  (select enabled from public.web_push_subscriptions where id = (select subscription_id from web_push_other_claim limit 1)),
  false,
  'retired endpoints are disabled'
);
select extensions.is(
  (select status from public.web_push_delivery_attempts where id = (select attempt_id from web_push_other_claim limit 1)),
  'abandoned',
  'retiring an endpoint abandons its outstanding attempt'
);

reset role;
delete from auth.users where id = '94000000-0000-4000-8000-000000000002';
select extensions.is(
  (select count(*)::bigint from public.web_push_subscriptions where user_id = '94000000-0000-4000-8000-000000000002'),
  0::bigint,
  'deleting an account cascades its push subscriptions'
);
select extensions.is(
  (select count(*)::bigint from public.web_push_delivery_attempts a where a.subscription_id = '94000000-0000-4000-8000-000000000103'),
  0::bigint,
  'deleting an account cascades its delivery attempts'
);

select * from extensions.finish();
rollback;
