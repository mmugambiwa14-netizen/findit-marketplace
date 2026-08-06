begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('84000000-0000-4000-8000-000000000001', 'listing-owner@example.test', '{"full_name":"Listing Owner"}', now(), now()),
  ('84000000-0000-4000-8000-000000000002', 'listing-stranger@example.test', '{"full_name":"Listing Stranger"}', now(), now());

insert into public.business_category_approvals (
  user_id, category, status, reviewed_at
) values (
  '84000000-0000-4000-8000-000000000001', 'car', 'approved', now()
);

create temporary table listing_fixture (
  intent_id uuid,
  storage_path text,
  listing_id uuid
) on commit drop;

grant select, insert, update on listing_fixture to service_role, authenticated;

set local role service_role;
insert into listing_fixture(intent_id, storage_path)
select
  public.authorize_listing_image_upload(
    '84000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001/staging/84000000-0000-4000-8000-000000000101.png',
    'image/png', 68, 1, 1, repeat('a', 64)
  ),
  '84000000-0000-4000-8000-000000000001/staging/84000000-0000-4000-8000-000000000101.png';
reset role;

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '84000000-0000-4000-8000-000000000201',
  'listing-images',
  '84000000-0000-4000-8000-000000000001/staging/84000000-0000-4000-8000-000000000101.png',
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  '{"mimetype":"image/png","size":68}'::jsonb
);

set local role service_role;
select extensions.lives_ok(
  $$select public.complete_listing_image_upload((select intent_id from listing_fixture))$$,
  'validated private media can be completed by the trusted upload boundary'
);
reset role;

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v1_listing_submission(
    '84000000-0000-4000-8000-000000000301',
    '{"kind":"car","title":"2022 Toyota Hilux double cab","description":"A complete vehicle listing with validated images and accurate seller supplied details.","category":"cars_sale","listingType":"sale","price":28000,"currency":"USD","negotiable":true,"locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Toyota","model":"Hilux","year":"2022","mileage":"32000","fuelType":"diesel","transmission":"automatic","condition":"used"}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from listing_fixture),
      'path', (select storage_path from listing_fixture)
    ))
  )$$,
  'an approved business can atomically create a validated listing'
);
reset role;

update listing_fixture
set listing_id = (
  select id from public.listings
  where submission_key = '84000000-0000-4000-8000-000000000301'
);

select extensions.is(
  (select status::text from public.listings where id = (select listing_id from listing_fixture)),
  'available',
  'validated listings publish immediately without human review'
);
select extensions.is(
  (select count(*)::bigint from public.car_details where listing_id = (select listing_id from listing_fixture)),
  1::bigint,
  'the category-specific detail row is created atomically'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media where listing_id = (select listing_id from listing_fixture)),
  1::bigint,
  'validated private media is attached atomically'
);
select extensions.is(
  (select state from public.listing_upload_intents where id = (select intent_id from listing_fixture)),
  'attached',
  'the media authorization is single-use after publication'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from public.listings where id = (select listing_id from listing_fixture)),
  1::bigint,
  'the published listing is immediately visible to anonymous visitors'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media where listing_id = (select listing_id from listing_fixture)),
  1::bigint,
  'published media metadata is visible through the public listing boundary'
);
reset role;

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.owner_transition_listing((select listing_id from listing_fixture), 'pause')$$,
  'the owner can pause a live listing'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.is(
  (select count(*)::bigint from public.listings where id = (select listing_id from listing_fixture)),
  0::bigint,
  'paused listings disappear from public reads'
);
reset role;

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.owner_transition_listing((select listing_id from listing_fixture), 'resume')$$,
  'the owner can resume a paused listing immediately'
);
select extensions.lives_ok(
  $$update public.listings
    set title = 'Updated 2022 Toyota Hilux double cab'
    where id = (select listing_id from listing_fixture)$$,
  'the owner can edit a live listing without creating a review queue'
);
select extensions.is(
  (select status::text from public.listings where id = (select listing_id from listing_fixture)),
  'available',
  'a valid live edit remains published'
);
select extensions.throws_ok(
  $$update public.listings set status = 'available'
    where id = (select listing_id from listing_fixture)$$,
  '42501',
  'listing-managed fields require a trusted operation',
  'owners still cannot bypass trusted state-transition operations'
);
select extensions.lives_ok(
  $$select public.owner_transition_listing((select listing_id from listing_fixture), 'unavailable')$$,
  'the owner can end the listing'
);
select extensions.lives_ok(
  $$select public.owner_transition_listing((select listing_id from listing_fixture), 'submit')$$,
  'the owner can relist an unavailable listing without human review'
);
select extensions.is(
  (select status::text from public.listings where id = (select listing_id from listing_fixture)),
  'available',
  'relisting returns the validated listing directly to the marketplace'
);
reset role;

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.owner_transition_listing((select listing_id from listing_fixture), 'pause')$$,
  'P0002',
  'listing not found',
  'another user cannot control the listing lifecycle'
);
reset role;

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$delete from public.listings where id = (select listing_id from listing_fixture)$$,
  'the owner can permanently delete their listing through the protected owner boundary'
);
reset role;

select extensions.is(
  (select count(*)::bigint from public.listings where id = (select listing_id from listing_fixture)),
  0::bigint,
  'permanent deletion removes the canonical listing row'
);
select extensions.is(
  (select count(*)::bigint from public.listing_media where listing_id = (select listing_id from listing_fixture)),
  0::bigint,
  'permanent deletion cascades listing media metadata'
);

select * from extensions.finish();
rollback;
