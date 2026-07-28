begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table test_cleanup_claims (
  intent_kind text,
  intent_id uuid,
  bucket_id text,
  storage_path text
) on commit drop;
grant select, insert, delete on table test_cleanup_claims to service_role;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000007001',
  'cleanup-owner@example.test',
  '{"full_name":"Cleanup Owner"}',
  now(), now()
);

insert into public.listing_upload_intents (
  id, user_id, storage_path, mime_type, byte_size, width_px, height_px,
  sha256_hex, state, expires_at
) values
  (
    '00000000-0000-4000-8000-000000007101',
    '00000000-0000-4000-8000-000000007001',
    '00000000-0000-4000-8000-000000007001/staging/00000000-0000-4000-8000-000000007201.png',
    'image/png', 68, 1, 1, repeat('a', 64), 'uploaded', now() - interval '1 hour'
  ),
  (
    '00000000-0000-4000-8000-000000007102',
    '00000000-0000-4000-8000-000000007001',
    '00000000-0000-4000-8000-000000007001/staging/00000000-0000-4000-8000-000000007202.png',
    'image/png', 68, 1, 1, repeat('b', 64), 'attached', now() - interval '1 hour'
  );

insert into public.marketplace_image_upload_intents (
  id, user_id, purpose, storage_path, mime_type, byte_size, width_px,
  height_px, sha256_hex, state, expires_at
) values (
  '00000000-0000-4000-8000-000000007103',
  '00000000-0000-4000-8000-000000007001',
  'service_photo',
  '00000000-0000-4000-8000-000000007001/service_photo/staging/00000000-0000-4000-8000-000000007203.png',
  'image/png', 68, 1, 1, repeat('c', 64), 'rejected', now() - interval '1 hour'
);

select extensions.is(
  has_function_privilege('anon', 'public.claim_expired_image_uploads(integer,timestamptz)', 'execute'),
  false,
  'anonymous sessions cannot claim expired image uploads'
);
select extensions.is(
  has_function_privilege('authenticated', 'public.claim_expired_image_uploads(integer,timestamptz)', 'execute'),
  false,
  'browser sessions cannot claim expired image uploads'
);
select extensions.is(
  has_function_privilege('service_role', 'public.claim_expired_image_uploads(integer,timestamptz)', 'execute'),
  true,
  'the service role can claim expired image uploads'
);
select extensions.is(
  has_function_privilege('authenticated', 'public.finalize_image_upload_cleanup(text,uuid,boolean,text,timestamptz)', 'execute'),
  false,
  'browser sessions cannot finalize image cleanup'
);
select extensions.is(
  has_function_privilege('anon', 'public.process_listing_expiry_notifications(timestamptz)', 'execute'),
  false,
  'anonymous sessions cannot invoke the service-only listing expiry worker'
);
select extensions.is(
  has_function_privilege('authenticated', 'public.process_listing_expiry_notifications(timestamptz)', 'execute'),
  false,
  'authenticated sessions cannot invoke the service-only listing expiry worker'
);

set local role authenticated;
select extensions.throws_matching(
  $$select * from public.claim_expired_image_uploads(10, now())$$,
  '.*permission denied for function claim_expired_image_uploads.*',
  'an authenticated user cannot invoke the cleanup claim boundary'
);

reset role;
set local role service_role;
insert into test_cleanup_claims
select * from public.claim_expired_image_uploads(10, now());

select extensions.is(
  (select count(*)::integer from test_cleanup_claims),
  2,
  'cleanup claims expired unattached intents from both private image buckets'
);
select extensions.is(
  (select count(*)::integer from public.listing_upload_intents where state = 'cleanup_pending'),
  1,
  'claiming closes the listing intent against concurrent attachment'
);
select extensions.is(
  (select state from public.listing_upload_intents where id = '00000000-0000-4000-8000-000000007102'),
  'attached',
  'attached listing media is never selected for cleanup'
);
select extensions.ok(
  public.finalize_image_upload_cleanup(
    'listing', '00000000-0000-4000-8000-000000007101', true, null, now()
  ),
  'successful object removal finalizes listing cleanup'
);
select extensions.is(
  (select state from public.listing_upload_intents where id = '00000000-0000-4000-8000-000000007101'),
  'cleaned',
  'successful cleanup leaves an auditable cleaned ledger state'
);
select extensions.ok(
  public.finalize_image_upload_cleanup(
    'marketplace', '00000000-0000-4000-8000-000000007103', false,
    'storage_remove_failed', now()
  ),
  'failed object removal schedules marketplace cleanup retry'
);
select extensions.is(
  (select state from public.marketplace_image_upload_intents where id = '00000000-0000-4000-8000-000000007103'),
  'rejected',
  'a failed cleanup restores the prior non-attachable intent state'
);
select extensions.is(
  (select cleanup_previous_state from public.marketplace_image_upload_intents
   where id = '00000000-0000-4000-8000-000000007103'),
  null,
  'a backed-off intent does not retain temporary claim metadata'
);
select extensions.ok(
  (select cleanup_retry_at > now() from public.marketplace_image_upload_intents
   where id = '00000000-0000-4000-8000-000000007103'),
  'a failed cleanup receives bounded retry backoff'
);
select extensions.is(
  (select count(*)::integer from public.claim_expired_image_uploads(10, now())),
  0,
  'the cleanup worker cannot immediately reclaim a backed-off failure'
);

reset role;
update public.marketplace_image_upload_intents
set cleanup_retry_at = now() - interval '1 minute'
where id = '00000000-0000-4000-8000-000000007103';

set local role service_role;
select extensions.is(
  (select count(*)::integer from public.claim_expired_image_uploads(10, now())),
  1,
  'a failed cleanup becomes claimable after its retry time'
);
select extensions.ok(
  public.finalize_image_upload_cleanup(
    'marketplace', '00000000-0000-4000-8000-000000007103', true, null, now()
  ),
  'a retried marketplace cleanup can complete idempotently'
);
select extensions.is(
  (select cleanup_attempts from public.marketplace_image_upload_intents
   where id = '00000000-0000-4000-8000-000000007103'),
  2,
  'cleanup attempts remain observable without recording provider error details'
);

select * from extensions.finish();
rollback;
