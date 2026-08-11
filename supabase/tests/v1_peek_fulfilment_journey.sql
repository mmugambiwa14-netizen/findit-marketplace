begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_row
    where function_row.oid = any (array[
      'private.apply_pending_response_peek_binding()'::regprocedure,
      'private.bind_response_peek(uuid,uuid[])'::regprocedure,
      'private.my_peek_request_activity_page(timestamptz,uuid,integer)'::regprocedure,
      'private.peek_thread_page_v2(uuid,uuid,text,text,integer,timestamptz,uuid,integer)'::regprocedure,
      'private.public_response_peek_metadata(uuid)'::regprocedure,
      'private.response_peek_request_candidates(uuid)'::regprocedure,
      'private.seller_unbound_response_peeks()'::regprocedure
    ])
      and (
        lower(pg_get_functiondef(function_row.oid)) like '%status = ''published''%'
        or lower(pg_get_functiondef(function_row.oid)) like '%status <> ''published''%'
      )
  ),
  0::bigint,
  'all Response Peek APIs use the canonical ready plus published_at lifecycle'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('83000000-0000-4000-8000-000000000001', 'peek-owner@example.test', '{"full_name":"Peek Owner"}', now(), now()),
  ('83000000-0000-4000-8000-000000000002', 'peek-buyer@example.test', '{"full_name":"Peek Buyer"}', now(), now()),
  ('83000000-0000-4000-8000-000000000003', 'peek-other@example.test', '{"full_name":"Other User"}', now(), now());

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '83000000-0000-4000-8000-000000000401',
  '83000000-0000-4000-8000-000000000001',
  'Peek Owner Motors', 'Peek Owner', 'peek-owner@example.test', '+263700000001',
  'ZW', 'Harare', 'Approved Cars publisher used for Peek fulfilment certification.',
  '1-10', 'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values (
  '83000000-0000-4000-8000-000000000402',
  '83000000-0000-4000-8000-000000000401',
  '83000000-0000-4000-8000-000000000001',
  'car', 'approved'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
select extensions.lives_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '83000000-0000-4000-8000-000000000101', 'car',
      '83000000-0000-4000-8000-000000000001', 'Peek Owner',
      'Peek fulfilment test vehicle',
      'A complete listing fixture used to certify the Response Peek fulfilment lifecycle.',
      12000, 'USD', 12000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'available'
    )$$,
  'the approved Cars owner can create the listing fixture through the authoritative boundary'
);

insert into public.peek_requests (
  id, listing_id, requester_id, category, body, status, moderation_status
) values
  (
    '83000000-0000-4000-8000-000000000201',
    '83000000-0000-4000-8000-000000000101',
    '83000000-0000-4000-8000-000000000002',
    'condition', 'Please show the rear tyres and wheel arches clearly.', 'pending', 'approved'
  ),
  (
    '83000000-0000-4000-8000-000000000202',
    '83000000-0000-4000-8000-000000000101',
    '83000000-0000-4000-8000-000000000002',
    'operation', 'Please demonstrate the engine starting from cold.', 'pending', 'approved'
  );

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.accept_peek_request('83000000-0000-4000-8000-000000000201')$$,
  '42501',
  'Only the listing owner can accept this Peek Request',
  'a non-owner cannot accept a seller Peek Request'
);
reset role;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.accept_peek_request('83000000-0000-4000-8000-000000000201')$$,
  'the listing owner can accept an approved pending request'
);
reset role;

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  'accepted',
  'acceptance persists independently of the browser session'
);

insert into public.listing_tours (
  id, owner_id, listing_id, source_storage_path, status, moderation_status, peek_kind
) values (
  '83000000-0000-4000-8000-000000000301',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000001/83000000-0000-4000-8000-000000000301/source/83000000-0000-4000-8000-000000000501.mp4',
  'uploaded', 'pending', 'response'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.queue_response_peek_binding(
    '83000000-0000-4000-8000-000000000301',
    '83000000-0000-4000-8000-000000000201'
  )$$,
  'an accepted request can be attached to an owner Response Peek'
);
reset role;

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  'uploading',
  'queued upload moves the persisted fulfilment into uploading'
);

update public.listing_tours
set status = 'processing'
where id = '83000000-0000-4000-8000-000000000301';

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  'processing',
  'the existing media pipeline drives the fulfilment processing state'
);

update public.listing_tours
set status = 'failed', failure_code = 'processor_failed', failure_message = 'Certification failure'
where id = '83000000-0000-4000-8000-000000000301';

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  'failed',
  'processing failure becomes a recoverable fulfilment failure'
);

select extensions.is(
  (select count(*)::bigint from public.peek_response_binding_intents where request_id = '83000000-0000-4000-8000-000000000201'),
  0::bigint,
  'a failed attempt removes its stale binding intent'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.accept_peek_request('83000000-0000-4000-8000-000000000201')$$,
  'the owner can retry a failed fulfilment within the bounded attempt limit'
);
reset role;

select extensions.is(
  (select attempt_count from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  2,
  'retry increments the persisted attempt counter'
);

insert into public.listing_tours (
  id, owner_id, listing_id, source_storage_path, playback_storage_path,
  thumbnail_storage_path, duration_seconds, width, height, processed_byte_size,
  ready_at, status, moderation_status, peek_kind
) values (
  '83000000-0000-4000-8000-000000000302',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000001/83000000-0000-4000-8000-000000000302/source/83000000-0000-4000-8000-000000000502.mp4',
  'listing/83000000-0000-4000-8000-000000000101/83000000-0000-4000-8000-000000000302.mp4',
  'listing/83000000-0000-4000-8000-000000000101/83000000-0000-4000-8000-000000000302.webp',
  30, 1280, 720, 2048, clock_timestamp(), 'ready', 'approved', 'response'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.queue_response_peek_binding(
    '83000000-0000-4000-8000-000000000302',
    '83000000-0000-4000-8000-000000000201'
  )$$,
  'the retry can queue a replacement Response Peek'
);
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.lives_ok(
  $$select public.promote_approved_tour('83000000-0000-4000-8000-000000000302')$$,
  'the trusted publication boundary promotes the ready approved Response Peek'
);
reset role;
select set_config('request.jwt.claim.role', '', true);

select extensions.is(
  (select status::text from public.peek_requests where id = '83000000-0000-4000-8000-000000000201'),
  'answered',
  'approved publication remains the only operation that answers the request'
);

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000201'),
  'completed',
  'the request answer transition closes the fulfilment as completed'
);

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '83000000-0000-4000-8000-000000000002'
     and event_type = 'peek_request_answered'),
  1::bigint,
  'the existing binding pipeline notifies the buyer exactly once'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.accept_peek_request('83000000-0000-4000-8000-000000000202');
select extensions.lives_ok(
  $$select public.cancel_peek_request_fulfilment(
    '83000000-0000-4000-8000-000000000202', 'Item is temporarily off site'
  )$$,
  'the owner can cancel an active fulfilment without declining the buyer request'
);
reset role;

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000202'),
  'cancelled',
  'cancellation is persisted as a retryable terminal attempt'
);

update public.peek_request_fulfilments
set status = 'accepted', cancelled_at = null, expires_at = now() - interval '1 minute'
where request_id = '83000000-0000-4000-8000-000000000202';

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.is(
  public.expire_stale_peek_request_fulfilments(100),
  1,
  'the bounded service worker expires stale active fulfilments'
);
reset role;
select set_config('request.jwt.claim.role', '', true);

select extensions.is(
  (select status from public.peek_request_fulfilments where request_id = '83000000-0000-4000-8000-000000000202'),
  'expired',
  'expiry persists for seller recovery and auditing'
);

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.ok(
  exists (
    select 1 from public.seller_peek_request_queue(null, null, null, 20)
    where request_id = '83000000-0000-4000-8000-000000000202'
      and fulfilment_status = 'expired'
  ),
  'seller queue reloads the persisted expiry state'
);
reset role;

select * from extensions.finish();
rollback;
