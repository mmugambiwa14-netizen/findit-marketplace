begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table test_uploads (
  label text primary key,
  intent_id uuid not null,
  storage_path text not null
) on commit drop;
grant select, insert, update, delete on table test_uploads to service_role;
grant select on table test_uploads to authenticated;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000004001', 'listing-owner@example.test', '{"full_name":"Listing Owner"}', now(), now()),
  ('00000000-0000-4000-8000-000000004002', 'listing-stranger@example.test', '{"full_name":"Listing Stranger"}', now(), now()),
  ('00000000-0000-4000-8000-000000004003', 'listing-suspended@example.test', '{"full_name":"Listing Suspended"}', now(), now()),
  ('00000000-0000-4000-8000-000000004004', 'listing-admin@example.test', '{"full_name":"Listing Admin"}', now(), now());

update public.users set status = 'suspended'
where id = '00000000-0000-4000-8000-000000004003';
update public.users set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-000000004004';

select extensions.is(
  (select public from storage.buckets where id = 'listing-images'),
  false,
  'listing images use a private bucket'
);
select extensions.is(
  (select file_size_limit from storage.buckets where id = 'listing-images'),
  5242880::bigint,
  'the listing image bucket enforces the five MiB limit'
);
select extensions.is(
  (select allowed_mime_types from storage.buckets where id = 'listing-images'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'the listing image bucket allows only V1 image formats'
);
select extensions.ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'listing_upload_intents'),
  'upload intents have RLS enabled'
);
select extensions.ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'listing_media'),
  'listing media has RLS enabled'
);
select extensions.is(
  has_function_privilege('authenticated', 'public.authorize_listing_image_upload(uuid,text,text,integer,integer,integer,text)', 'execute'),
  false,
  'browser sessions cannot mint trusted upload authorizations'
);
select extensions.is(
  has_function_privilege('service_role', 'public.authorize_listing_image_upload(uuid,text,text,integer,integer,integer,text)', 'execute'),
  true,
  'the server role can mint trusted upload authorizations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.throws_matching(
  $$insert into public.listings (kind, seller_id, title, price)
    values ('car', '00000000-0000-4000-8000-000000004001', 'Bypass attempt', 1)$$,
  '.*permission denied for table listings.*',
  'owners cannot bypass the atomic listing submission operation'
);
select extensions.throws_matching(
  $$select public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004101.png',
    'image/png', 68, 1, 1, repeat('a', 64))$$,
  '.*permission denied for function authorize_listing_image_upload.*',
  'owners cannot invoke the server-only upload authorization function'
);

reset role;
set local role service_role;
select extensions.throws_ok(
  $$select public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000004001',
    'wrong-folder/staging/not-an-image.exe',
    'application/octet-stream', 68, 1, 1, repeat('a', 64))$$,
  '22023',
  'invalid image metadata',
  'the server upload boundary rejects invalid paths and media types'
);
insert into test_uploads (label, intent_id, storage_path)
select
  'primary',
  public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004101.png',
    'image/png', 68, 1, 1, repeat('a', 64)
  ),
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004101.png';
insert into test_uploads (label, intent_id, storage_path)
select
  'replacement',
  public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004103.png',
    'image/png', 68, 1, 1, repeat('c', 64)
  ),
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004103.png';
select extensions.is(
  (select count(*)::bigint from test_uploads where label = 'primary'),
  1::bigint,
  'a valid server inspection creates one upload authorization'
);

reset role;
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000004201',
  'listing-images',
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004101.png',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000004001',
  '{"mimetype":"image/png","size":68}'::jsonb
);
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000004203',
  'listing-images',
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004103.png',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000004001',
  '{"mimetype":"image/png","size":68}'::jsonb
);

set local role service_role;
select extensions.lives_ok(
  $$select public.complete_listing_image_upload((select intent_id from test_uploads where label = 'primary'))$$,
  'the server confirms an object whose owner and metadata match its authorization'
);
select extensions.lives_ok(
  $$select public.complete_listing_image_upload((select intent_id from test_uploads where label = 'replacement'))$$,
  'the server confirms the replacement listing image object'
);
select extensions.throws_ok(
  $$select public.complete_listing_image_upload((select intent_id from test_uploads where label = 'primary'))$$,
  'P0002',
  'upload authorization is invalid or expired',
  'an upload authorization cannot be completed twice'
);

insert into test_uploads (label, intent_id, storage_path)
select
  'deleted',
  public.authorize_listing_image_upload(
    '00000000-0000-4000-8000-000000004001',
    '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004102.png',
    'image/png', 68, 1, 1, repeat('b', 64)
  ),
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004102.png';
reset role;
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000004202',
  'listing-images',
  '00000000-0000-4000-8000-000000004001/staging/00000000-0000-4000-8000-000000004102.png',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000004001',
  '{"mimetype":"image/png","size":68}'::jsonb
);
set local role service_role;
select public.complete_listing_image_upload((select intent_id from test_uploads where label = 'deleted'));
reset role;
delete from storage.objects where id = '00000000-0000-4000-8000-000000004202';

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000004301',
    '{"kind":"car","title":"2020 Toyota Hilux double cab","description":"A carefully maintained Zimbabwe-market vehicle with a clear description and contact details.","category":"cars_sale","listingType":"sale","price":24500,"currency":"USD","negotiable":true,"locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Toyota","model":"Hilux","year":"2020","mileage":"55000","fuelType":"diesel","transmission":"manual","condition":"used"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from test_uploads where label = 'primary'),
      'path', (select storage_path from test_uploads where label = 'primary')
    ))
  )$$,
  'an owner can submit one validated V1 listing atomically'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'pending_review',
  'new product listings enter the moderation queue'
);
select extensions.is(
  (select count(*)::bigint from public.car_details d join public.listings l on l.id = d.listing_id
   where l.submission_key = '00000000-0000-4000-8000-000000004301'),
  1::bigint,
  'the matching detail row is created in the same transaction'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media m join public.listings l on l.id = m.listing_id
   where l.submission_key = '00000000-0000-4000-8000-000000004301'),
  1::bigint,
  'validated media is attached in the same transaction'
);
reset role;
select extensions.is(
  (select state from public.listing_upload_intents where id = (select intent_id from test_uploads where label = 'primary')),
  'attached',
  'the upload authorization becomes single-use after attachment'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000004301', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  )$$,
  'retrying the same submission key is idempotent'
);
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  1::bigint,
  'an idempotent retry does not duplicate the listing'
);
select extensions.throws_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000004302',
    '{"kind":"car","title":"Deleted image integrity check","description":"A complete valid listing payload must still fail if its previously confirmed object was removed.","category":"cars_sale","listingType":"sale","price":100,"currency":"USD","locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Toyota","model":"Test"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from test_uploads where label = 'deleted'),
      'path', (select storage_path from test_uploads where label = 'deleted')
    ))
  )$$,
  '22023',
  'listing image is invalid, expired, or already attached',
  'a deleted object cannot be attached using a stale completed intent'
);
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'listing-images'),
  2::bigint,
  'the owner can read private attached and replacement objects'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  0::bigint,
  'anonymous visitors cannot see a pending listing'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media),
  0::bigint,
  'anonymous visitors cannot see media for a pending listing'
);
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'listing-images'),
  0::bigint,
  'anonymous visitors cannot read an object for a pending listing'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004002', true);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  0::bigint,
  'another signed-in user cannot see the pending listing'
);
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'listing-images'),
  0::bigint,
  'another signed-in user cannot read its private media'
);
select extensions.throws_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000004301', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  )$$,
  '23505',
  'submission key already used',
  'another user cannot claim an existing idempotency key'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004004', true);
set local role authenticated;
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  1::bigint,
  'an active admin can see the pending moderation item'
);
select extensions.lives_ok(
  $$select public.admin_moderate_marketplace_item(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
    'car', 'publish', 'The listing meets the marketplace rules'
  )$$,
  'an admin can approve a pending listing'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'available',
  'approval makes the listing available'
);
reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts a join public.listings l on l.id = a.listing_id
   where l.submission_key = '00000000-0000-4000-8000-000000004301' and a.event_type = 'listing_approved'),
  1::bigint,
  'approval creates the essential owner notification'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004004', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.admin_moderate_marketplace_item(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
    'car', 'reject', 'Invalid transition check'
  )$$,
  '22023',
  'moderation action is not allowed from the current status',
  'an admin cannot reject a listing that is already live'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  1::bigint,
  'anonymous visitors can see the approved listing'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media),
  1::bigint,
  'anonymous visitors can see approved listing media metadata'
);
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'listing-images'),
  1::bigint,
  'anonymous visitors can read approved listing media through Storage policy'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.owner_transition_listing(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'), 'pause'
  )$$,
  'the owner can pause a live listing'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'paused',
  'owner pause uses the explicit paused state'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  0::bigint,
  'a paused listing is hidden from public reads'
);
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'listing-images'),
  0::bigint,
  'a paused listing also hides its private object'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.owner_transition_listing(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'), 'resume'
  )$$,
  'the owner can resume a paused listing'
);
select extensions.lives_ok(
  $$update public.listings set title = 'Updated Toyota Hilux double cab'
    where submission_key = '00000000-0000-4000-8000-000000004301'$$,
  'the owner can edit approved listing content'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'pending_review',
  'editing approved content automatically returns it to review'
);
select extensions.throws_ok(
  $$update public.listings set status = 'available'
    where submission_key = '00000000-0000-4000-8000-000000004301'$$,
  '42501',
  'listing-managed fields require a trusted operation',
  'an owner cannot publish by directly changing status'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004004', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.admin_moderate_marketplace_item(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
    'car', 'reject', 'Please clarify the vehicle history'
  )$$,
  'an admin can reject the revised pending submission'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'rejected',
  'rejection uses the explicit rejected state'
);
select extensions.is(
  (select moderation_reason from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'Please clarify the vehicle history',
  'the owner-visible rejection reason is retained'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
set local role authenticated;
select extensions.throws_ok(
  $$update public.listings set photos = '["https://evil.example/replacement.png"]'::jsonb
    where submission_key = '00000000-0000-4000-8000-000000004301'$$,
  '42501',
  'listing photos require a trusted operation',
  'an owner cannot bypass trusted media while a listing is rejected'
);
select extensions.lives_ok(
  $$select public.replace_listing_media(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
    array[]::text[],
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from test_uploads where label = 'replacement'),
      'path', (select storage_path from test_uploads where label = 'replacement')
    )))$$,
  'the owner can atomically replace trusted listing media'
);
select extensions.is(
  (select photos ->> 0 from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  (select storage_path from test_uploads where label = 'replacement'),
  'listing replacement rebuilds the compatibility photo list'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'rejected',
  'replacing images preserves a rejected listing until explicit resubmission'
);
select extensions.lives_ok(
  $$delete from storage.objects where bucket_id = 'listing-images'
      and name = (select storage_path from test_uploads where label = 'primary')$$,
  'the owner can delete the product image detached by replacement'
);
select extensions.lives_ok(
  $$select public.owner_transition_listing(
    (select id from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'), 'submit'
  )$$,
  'the owner can submit the edited rejected listing for review'
);
select extensions.is(
  (select status::text from public.listings where submission_key = '00000000-0000-4000-8000-000000004301'),
  'pending_review',
  'edited listing media follows the protected review lifecycle'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004003', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.create_v1_listing_submission(
    '00000000-0000-4000-8000-000000004303', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  )$$,
  '42501',
  'active account required',
  'a suspended account cannot submit a listing'
);

select * from extensions.finish();
rollback;
