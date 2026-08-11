begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table test_marketplace_uploads (
  label text primary key,
  intent_id uuid not null,
  storage_path text not null
) on commit drop;
grant select, insert, update, delete on table test_marketplace_uploads to service_role;
grant select on table test_marketplace_uploads to authenticated;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000005001', 'media-owner@example.test', '{"full_name":"Media Owner"}', now(), now()),
  ('00000000-0000-4000-8000-000000005002', 'media-stranger@example.test', '{"full_name":"Media Stranger"}', now(), now());

-- Pass the curated publisher gate so this suite isolates the media boundary.
insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '00000000-0000-4000-8000-000000005401',
  '00000000-0000-4000-8000-000000005001',
  'Trusted Media Business', 'Media Owner', 'media-owner@example.test',
  '+263700005001', 'ZW', 'Harare',
  'Approved service publisher used to certify private marketplace media.',
  '1-10', 'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status, approved_at
) values (
  '00000000-0000-4000-8000-000000005402',
  '00000000-0000-4000-8000-000000005401',
  '00000000-0000-4000-8000-000000005001',
  'service', 'approved', now()
);

select extensions.is(
  (select public from storage.buckets where id = 'marketplace-images'),
  false,
  'marketplace profile media uses a private bucket'
);
select extensions.is(
  (select file_size_limit from storage.buckets where id = 'marketplace-images'),
  5242880::bigint,
  'the marketplace image bucket enforces the five MiB limit'
);
select extensions.is(
  (select allowed_mime_types from storage.buckets where id = 'marketplace-images'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'the marketplace image bucket allows only V1 image formats'
);
select extensions.ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'marketplace_image_upload_intents'),
  'marketplace upload intents have RLS enabled'
);
select extensions.ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'service_media'),
  'service media has RLS enabled'
);
select extensions.is(
  has_function_privilege('authenticated', 'public.authorize_marketplace_image_upload(uuid,text,text,text,integer,integer,integer,text)', 'execute'),
  false,
  'browser sessions cannot mint marketplace upload authorizations'
);
select extensions.is(
  has_function_privilege('service_role', 'public.authorize_marketplace_image_upload(uuid,text,text,text,integer,integer,integer,text)', 'execute'),
  true,
  'the server role can mint marketplace upload authorizations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005001', true);
set local role authenticated;
select extensions.throws_matching(
  $$select public.authorize_marketplace_image_upload(
    '00000000-0000-4000-8000-000000005001', 'service_photo',
    '00000000-0000-4000-8000-000000005001/service_photo/staging/00000000-0000-4000-8000-000000005101.png',
    'image/png', 68, 1, 1, repeat('a', 64))$$,
  '.*permission denied for function authorize_marketplace_image_upload.*',
  'owners cannot invoke the server-only marketplace authorization function'
);
select extensions.throws_ok(
  $$insert into public.services (
      provider_id, provider_name, contact_phone, title, category, photos
    ) values (
      '00000000-0000-4000-8000-000000005001', 'Media Owner', '123',
      'Untrusted photo service', 'mechanic', '["https://evil.example/photo.png"]'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "services"',
  'service creation cannot smuggle an untrusted external photo'
);
insert into public.services (
  id, provider_id, provider_name, contact_phone, title, category, photos, status
) values (
  '00000000-0000-4000-8000-000000005201',
  '00000000-0000-4000-8000-000000005001',
  'Media Owner', '123', 'Trusted media service', 'mechanic', '[]'::jsonb, 'active'
);
insert into public.business_profiles (
  id, user_id, company_name, business_type, phone
) values (
  '00000000-0000-4000-8000-000000005202',
  '00000000-0000-4000-8000-000000005001',
  'Trusted Media Business', 'other', '123'
);

reset role;
set local role service_role;
insert into test_marketplace_uploads (label, intent_id, storage_path)
select 'service', public.authorize_marketplace_image_upload(
  '00000000-0000-4000-8000-000000005001', 'service_photo',
  '00000000-0000-4000-8000-000000005001/service_photo/staging/00000000-0000-4000-8000-000000005101.png',
  'image/png', 68, 1, 1, repeat('a', 64)
), '00000000-0000-4000-8000-000000005001/service_photo/staging/00000000-0000-4000-8000-000000005101.png';
insert into test_marketplace_uploads (label, intent_id, storage_path)
select 'business', public.authorize_marketplace_image_upload(
  '00000000-0000-4000-8000-000000005001', 'business_logo',
  '00000000-0000-4000-8000-000000005001/business_logo/staging/00000000-0000-4000-8000-000000005102.webp',
  'image/webp', 80, 1, 1, repeat('b', 64)
), '00000000-0000-4000-8000-000000005001/business_logo/staging/00000000-0000-4000-8000-000000005102.webp';
insert into test_marketplace_uploads (label, intent_id, storage_path)
select 'service-edit', public.authorize_marketplace_image_upload(
  '00000000-0000-4000-8000-000000005001', 'service_photo',
  '00000000-0000-4000-8000-000000005001/service_photo/staging/00000000-0000-4000-8000-000000005103.png',
  'image/png', 68, 1, 1, repeat('c', 64)
), '00000000-0000-4000-8000-000000005001/service_photo/staging/00000000-0000-4000-8000-000000005103.png';

reset role;
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
select
  '00000000-0000-4000-8000-000000005301', 'marketplace-images', storage_path,
  '00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000005001',
  '{"mimetype":"image/png","size":68}'::jsonb
from test_marketplace_uploads where label = 'service';
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
select
  '00000000-0000-4000-8000-000000005302', 'marketplace-images', storage_path,
  '00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000005001',
  '{"mimetype":"image/webp","size":80}'::jsonb
from test_marketplace_uploads where label = 'business';
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
select
  '00000000-0000-4000-8000-000000005303', 'marketplace-images', storage_path,
  '00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000005001',
  '{"mimetype":"image/png","size":68}'::jsonb
from test_marketplace_uploads where label = 'service-edit';

set local role service_role;
select extensions.lives_ok(
  $$select public.complete_marketplace_image_upload(
    (select intent_id from test_marketplace_uploads where label = 'service'))$$,
  'the server confirms a matching service image object'
);
select extensions.lives_ok(
  $$select public.complete_marketplace_image_upload(
    (select intent_id from test_marketplace_uploads where label = 'business'))$$,
  'the server confirms a matching business logo object'
);
select extensions.lives_ok(
  $$select public.complete_marketplace_image_upload(
    (select intent_id from test_marketplace_uploads where label = 'service-edit'))$$,
  'the server confirms a replacement service image object'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.attach_marketplace_image(
    (select intent_id from test_marketplace_uploads where label = 'service'),
    (select storage_path from test_marketplace_uploads where label = 'service'),
    'service', '00000000-0000-4000-8000-000000005201', 0)$$,
  '22023',
  'image is invalid, expired, or already attached',
  'a stranger cannot attach another owner image'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.attach_marketplace_image(
    (select intent_id from test_marketplace_uploads where label = 'service'),
    (select storage_path from test_marketplace_uploads where label = 'service'),
    'service', '00000000-0000-4000-8000-000000005201', 0)$$,
  'the owner can attach a validated service image'
);
select extensions.is(
  (select count(*)::bigint from public.service_media where service_id = '00000000-0000-4000-8000-000000005201'),
  1::bigint,
  'the attached service image has one metadata row'
);
select extensions.is(
  (select jsonb_array_length(photos) from public.services where id = '00000000-0000-4000-8000-000000005201'),
  1,
  'the service compatibility photo list contains the trusted path'
);
select extensions.throws_ok(
  $$update public.services set photos = '["https://evil.example/replaced.png"]'::jsonb
    where id = '00000000-0000-4000-8000-000000005201'$$,
  '42501',
  'service-managed fields require a trusted operation',
  'an owner cannot bypass the trusted service-media operation'
);
select extensions.lives_ok(
  $$select public.attach_marketplace_image(
    (select intent_id from test_marketplace_uploads where label = 'business'),
    (select storage_path from test_marketplace_uploads where label = 'business'),
    'business', '00000000-0000-4000-8000-000000005202', 0)$$,
  'the owner can attach a validated business logo'
);
select extensions.is(
  (select avatar_storage_path from public.business_profiles where id = '00000000-0000-4000-8000-000000005202'),
  (select storage_path from test_marketplace_uploads where label = 'business'),
  'the business profile stores the trusted logo path'
);
select extensions.lives_ok(
  $$select public.replace_service_media(
    '00000000-0000-4000-8000-000000005201', array[]::text[],
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from test_marketplace_uploads where label = 'service-edit'),
      'path', (select storage_path from test_marketplace_uploads where label = 'service-edit')
    )))$$,
  'the owner can atomically replace an attached service image'
);
select extensions.is(
  (select photos ->> 0 from public.services where id = '00000000-0000-4000-8000-000000005201'),
  (select storage_path from test_marketplace_uploads where label = 'service-edit'),
  'service replacement rebuilds the compatibility photo list'
);
reset role;
set local role service_role;
select extensions.is(
  (select state from public.marketplace_image_upload_intents
    where id = (select intent_id from test_marketplace_uploads where label = 'service-edit')),
  'attached',
  'service replacement consumes the new upload intent'
);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005001', true);
set local role authenticated;
select extensions.throws_ok(
  $$delete from storage.objects where bucket_id = 'marketplace-images'
      and name = (select storage_path from test_marketplace_uploads where label = 'service')$$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'direct SQL cannot bypass the Storage API deletion boundary'
);
select set_config('storage.allow_delete_query', 'true', true);
select extensions.lives_ok(
  $$delete from storage.objects where bucket_id = 'marketplace-images'
      and name = (select storage_path from test_marketplace_uploads where label = 'service')$$,
  'the Storage API-authorized path can delete the service object detached by replacement'
);
select set_config('storage.allow_delete_query', 'false', true);
select extensions.throws_ok(
  $$update public.business_profiles set avatar_storage_path = null
    where id = '00000000-0000-4000-8000-000000005202'$$,
  '42501',
  'business-profile managed fields require a trusted operation',
  'an owner cannot bypass the trusted business-logo operation'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'marketplace-images'),
  2::bigint,
  'anonymous visitors can authorize signed reads for active service and business media'
);
select extensions.is(
  (select count(*)::bigint from public.service_media where service_id = '00000000-0000-4000-8000-000000005201'),
  1::bigint,
  'anonymous visitors can read active service media metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005001', true);
set local role authenticated;
update public.services set status = 'paused' where id = '00000000-0000-4000-8000-000000005201';

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from storage.objects where bucket_id = 'marketplace-images'),
  1::bigint,
  'pausing a service hides its image while the active business logo remains visible'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.detach_marketplace_image(
    'service', '00000000-0000-4000-8000-000000005201',
    (select storage_path from test_marketplace_uploads where label = 'service-edit'))$$,
  'the owner can detach a service image'
);
select extensions.is(
  (select photos from public.services where id = '00000000-0000-4000-8000-000000005201'),
  '[]'::jsonb,
  'detaching rebuilds the service photo list'
);
select set_config('storage.allow_delete_query', 'true', true);
select extensions.lives_ok(
  $$delete from storage.objects where bucket_id = 'marketplace-images'
      and name = (select storage_path from test_marketplace_uploads where label = 'service-edit')$$,
  'the Storage API-authorized path can delete a detached service object'
);
select extensions.lives_ok(
  $$select public.detach_marketplace_image(
    'business', '00000000-0000-4000-8000-000000005202',
    (select storage_path from test_marketplace_uploads where label = 'business'))$$,
  'the owner can detach a business logo'
);
select extensions.lives_ok(
  $$delete from storage.objects where bucket_id = 'marketplace-images'
      and name = (select storage_path from test_marketplace_uploads where label = 'business')$$,
  'the Storage API-authorized path can delete a detached business object'
);
select set_config('storage.allow_delete_query', 'false', true);

select * from extensions.finish();
rollback;
