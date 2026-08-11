begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  to_regclass('public.listing_tours') is not null
  and to_regclass('public.listing_tour_slots') is not null
  and to_regclass('public.listing_tour_upload_intents') is not null,
  'the dormant Tour schema is installed'
);

select extensions.is(
  (select enabled from public.marketplace_feature_controls where feature_key = 'tours'),
  false,
  'the database Tour switch defaults closed'
);

select extensions.is(
  (select public from storage.buckets where id = 'tour-sources'),
  false,
  'Tour source storage is private'
);
select extensions.is(
  (select public from storage.buckets where id = 'tour-playback'),
  false,
  'Tour playback storage is private'
);
select extensions.is(
  (select public from storage.buckets where id = 'tour-thumbnails'),
  false,
  'Tour thumbnail storage is private'
);

select extensions.is(
  has_table_privilege('authenticated', 'public.listing_tours', 'insert'),
  false,
  'browser users cannot insert Tour state directly'
);
select extensions.is(
  has_function_privilege(
    'authenticated',
    'public.authorize_tour_processing_callback(uuid,uuid,text)',
    'execute'
  ),
  false,
  'browser users cannot bind processor callbacks'
);
select extensions.is(
  has_function_privilege(
    'service_role',
    'public.authorize_tour_processing_callback(uuid,uuid,text)',
    'execute'
  ),
  true,
  'the service role can bind authenticated processor callbacks'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '00000000-0000-4000-8000-000000009001',
    'tour-owner@example.test',
    '{"full_name":"Tour Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000009002',
    'tour-stranger@example.test',
    '{"full_name":"Tour Stranger"}',
    now(), now()
  );

-- Fixture setup, but it still crosses enforce_curated_listing_publisher, which
-- matches on kind and requires seller_id = auth.uid(). Auth is opened only for
-- this insert and cleared before the Tour assertions below.
insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
)
values (
  '00000000-0000-4000-8000-000000009501',
  '00000000-0000-4000-8000-000000009001',
  'Tour Owner Motors',
  'Tour Owner',
  'tour-owner@example.test',
  '+263700009501',
  'ZW',
  'Harare',
  'Approved fixture business used only to certify Tour foundation boundaries.',
  '1-10',
  'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
)
values
  (
    '00000000-0000-4000-8000-000000009502',
    '00000000-0000-4000-8000-000000009501',
    '00000000-0000-4000-8000-000000009001',
    'car',
    'approved'
  ),
  (
    '00000000-0000-4000-8000-000000009503',
    '00000000-0000-4000-8000-000000009501',
    '00000000-0000-4000-8000-000000009001',
    'service',
    'approved'
  );

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  category, listing_type, status
) values (
  '00000000-0000-4000-8000-000000009101',
  'car',
  '00000000-0000-4000-8000-000000009001',
  'Tour Owner',
  'Tour foundation fixture',
  'A database-only Tour lifecycle fixture.',
  12000,
  'USD',
  'cars_sale',
  'sale',
  'available'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select extensions.throws_matching(
  $$
    insert into public.listing_tours (
      id, owner_id, listing_id, source_storage_path, status, moderation_status
    ) values (
      '00000000-0000-4000-8000-000000009201',
      '00000000-0000-4000-8000-000000009002',
      '00000000-0000-4000-8000-000000009101',
      '00000000-0000-4000-8000-000000009002/00000000-0000-4000-8000-000000009201/source/00000000-0000-4000-8000-000000009301.mp4',
      'created',
      'pending'
    )
  $$,
  '.*Tour owner must match parent owner.*',
  'a Tour cannot be attached by a different marketplace owner'
);

insert into public.listing_tours (
  id, owner_id, listing_id, source_storage_path, playback_storage_path,
  thumbnail_storage_path, status, moderation_status, duration_seconds,
  width, height, aspect_ratio, mime_type, source_byte_size,
  processed_byte_size, ready_at, approved_at, published_at
) values (
  '00000000-0000-4000-8000-000000009202',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009101',
  '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009202/source/00000000-0000-4000-8000-000000009302.mp4',
  'listing/00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009202.mp4',
  'listing/00000000-0000-4000-8000-000000009101/00000000-0000-4000-8000-000000009202.webp',
  'ready',
  'approved',
  60,
  1280,
  720,
  1.777778,
  'video/mp4',
  100,
  80,
  now(),
  now(),
  now()
);

insert into public.listing_tour_slots (
  owner_id, listing_id, current_tour_id
) values (
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009101',
  '00000000-0000-4000-8000-000000009202'
);

update public.marketplace_feature_controls
set enabled = true
where feature_key = 'tours';

select extensions.ok(
  public.is_tour_public_eligible('00000000-0000-4000-8000-000000009202'),
  'a current ready approved published Tour on an available parent is eligible'
);

select extensions.throws_matching(
  $$
    update public.listing_tour_slots
    set pending_tour_id = current_tour_id
    where listing_id = '00000000-0000-4000-8000-000000009101'
  $$,
  '.*listing_tour_slots_distinct_versions.*',
  'the current and pending Tour versions cannot be the same row'
);

update public.listings
set status = 'sold'
where id = '00000000-0000-4000-8000-000000009101';

select extensions.is(
  public.is_tour_public_eligible('00000000-0000-4000-8000-000000009202'),
  false,
  'an unavailable parent immediately removes its Tour from public eligibility'
);
select extensions.is(
  (select published_at from public.listing_tours where id = '00000000-0000-4000-8000-000000009202'),
  null::timestamptz,
  'parent unavailability clears the public Tour publication timestamp'
);


-- Reopen fixture auth for this publisher-crossing insert.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  category, listing_type, status
) values
  (
    '00000000-0000-4000-8000-000000009102', 'car',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner',
    'Pending review Tour fixture', 'A pending review listing used by the seller workflow gate.',
    13000, 'USD', 'cars_sale', 'sale', 'pending_review'
  ),
  (
    '00000000-0000-4000-8000-000000009103', 'car',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner',
    'Unavailable Tour fixture', 'An unavailable listing used by the seller workflow denial gate.',
    14000, 'USD', 'cars_sale', 'sale', 'unavailable'
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select extensions.lives_ok(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009203',
      '00000000-0000-4000-8000-000000009102',
      null,
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009203/source/00000000-0000-4000-8000-000000009303.mp4',
      'pending-review.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009403'
    )
  $$,
  'a canonical pending-review listing can authorize its optional seller Tour'
);

select extensions.throws_matching(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009204',
      '00000000-0000-4000-8000-000000009103',
      null,
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009204/source/00000000-0000-4000-8000-000000009304.mp4',
      'unavailable.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009404'
    )
  $$,
  '.*listing is not eligible for a Tour.*',
  'an unavailable listing remains closed to new Tour uploads'
);

-- Reopen fixture auth for this publisher-crossing insert.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.services (
  id, provider_id, provider_name, contact_phone, title, description,
  category, subcategory, subcategories, pricing_type, status
) values
  (
    '00000000-0000-4000-8000-000000009104',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner', '+263771234567',
    'Active service Tour fixture', 'An active service used by the seller workflow gate.',
    'mechanic', 'maintenance_repair', '["maintenance_repair"]'::jsonb,
    'starting_from', 'active'
  ),
  (
    '00000000-0000-4000-8000-000000009105',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner', '+263771234567',
    'Unavailable service Tour fixture', 'An unavailable service used by the denial gate.',
    'mechanic', 'maintenance_repair', '["maintenance_repair"]'::jsonb,
    'starting_from', 'unavailable'
  ),
  (
    '00000000-0000-4000-8000-000000009106',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner', '+263771234567',
    'Legal service Tour fixture', 'A retained legal service used by the exclusion gate.',
    'legal', 'general', '["general"]'::jsonb,
    'starting_from', 'active'
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select extensions.lives_ok(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009205',
      null,
      '00000000-0000-4000-8000-000000009104',
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009205/source/00000000-0000-4000-8000-000000009305.mp4',
      'service-work.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009405'
    )
  $$,
  'an active non-legal service can authorize its optional seller Tour'
);

select extensions.throws_matching(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009206',
      null,
      '00000000-0000-4000-8000-000000009105',
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009206/source/00000000-0000-4000-8000-000000009306.mp4',
      'unavailable-service.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009406'
    )
  $$,
  '.*service is not eligible for a Tour.*',
  'an unavailable service remains closed to new Tour uploads'
);

select extensions.throws_matching(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009207',
      null,
      '00000000-0000-4000-8000-000000009106',
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009207/source/00000000-0000-4000-8000-000000009307.mp4',
      'legal-service.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009407'
    )
  $$,
  '.*Tour parent not found.*',
  'legal services remain excluded from Tours in the MVP'
);


-- Reopen fixture auth for this publisher-crossing insert.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id, kind, seller_id, seller_name, title, description, price, currency,
  category, listing_type, status
) values
  (
    '00000000-0000-4000-8000-000000009107', 'car',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner',
    'Renewable Tour intent fixture', 'An expired authorization renewal fixture.',
    15000, 'USD', 'cars_sale', 'sale', 'pending_review'
  ),
  (
    '00000000-0000-4000-8000-000000009108', 'car',
    '00000000-0000-4000-8000-000000009001', 'Tour Owner',
    'Late Tour completion fixture', 'An exact-object late confirmation fixture.',
    16000, 'USD', 'cars_sale', 'sale', 'pending_review'
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select * from public.authorize_tour_upload(
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009208',
  '00000000-0000-4000-8000-000000009107',
  null,
  '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009208/source/00000000-0000-4000-8000-000000009308.mp4',
  'renewable.mp4', 'video/mp4', 100, 30, null,
  '00000000-0000-4000-8000-000000009408'
);

update public.listing_tour_upload_intents
set expires_at = now() - interval '1 minute'
where idempotency_key = '00000000-0000-4000-8000-000000009408';

select extensions.is(
  (
    select renewed.tour_id
    from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009209',
      '00000000-0000-4000-8000-000000009107',
      null,
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009209/source/00000000-0000-4000-8000-000000009309.mp4',
      'renewable.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009408'
    ) renewed
  ),
  '00000000-0000-4000-8000-000000009208'::uuid,
  'an expired authorization renews the same Tour identity'
);

select extensions.throws_matching(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009209',
      '00000000-0000-4000-8000-000000009107',
      null,
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009209/source/00000000-0000-4000-8000-000000009309.mp4',
      'changed-metadata.mp4', 'video/mp4', 100, 31, null,
      '00000000-0000-4000-8000-000000009408'
    )
  $$,
  '.*idempotency key does not match this upload.*',
  'an idempotency key cannot be reused with changed media metadata'
);

select extensions.is(
  (
    select source_storage_path
    from public.listing_tour_upload_intents
    where idempotency_key = '00000000-0000-4000-8000-000000009408'
  ),
  '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009208/source/00000000-0000-4000-8000-000000009308.mp4',
  'authorization renewal preserves the original private object path'
);

select extensions.ok(
  (
    select expires_at > now()
    from public.listing_tour_upload_intents
    where idempotency_key = '00000000-0000-4000-8000-000000009408'
  ),
  'authorization renewal returns the intent to an active window'
);

update public.listings
set status = 'unavailable'
where id = '00000000-0000-4000-8000-000000009107';

update public.listing_tour_upload_intents
set expires_at = now() - interval '1 minute'
where idempotency_key = '00000000-0000-4000-8000-000000009408';

select extensions.throws_matching(
  $$
    select * from public.authorize_tour_upload(
      '00000000-0000-4000-8000-000000009001',
      '00000000-0000-4000-8000-000000009209',
      '00000000-0000-4000-8000-000000009107',
      null,
      '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009209/source/00000000-0000-4000-8000-000000009309.mp4',
      'renewable.mp4', 'video/mp4', 100, 30, null,
      '00000000-0000-4000-8000-000000009408'
    )
  $$,
  '.*listing is not eligible for a Tour.*',
  'an expired authorization cannot renew after its parent becomes unavailable'
);

select * from public.authorize_tour_upload(
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009210',
  '00000000-0000-4000-8000-000000009108',
  null,
  '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009210/source/00000000-0000-4000-8000-000000009310.mp4',
  'late-completion.mp4', 'video/mp4', 100, 30, null,
  '00000000-0000-4000-8000-000000009410'
);

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '00000000-0000-4000-8000-000000009510',
  'tour-sources',
  '00000000-0000-4000-8000-000000009001/00000000-0000-4000-8000-000000009210/source/00000000-0000-4000-8000-000000009310.mp4',
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009001',
  '{"size":100,"mimetype":"video/mp4"}'::jsonb
);

update public.listing_tour_upload_intents
set expires_at = now() - interval '1 minute'
where idempotency_key = '00000000-0000-4000-8000-000000009410';

select extensions.is(
  public.complete_tour_upload(
    '00000000-0000-4000-8000-000000009001',
    (
      select id from public.listing_tour_upload_intents
      where idempotency_key = '00000000-0000-4000-8000-000000009410'
    )
  ),
  '00000000-0000-4000-8000-000000009210'::uuid,
  'an exact object accepted before expiry can be confirmed after the authorization window'
);

select extensions.is(
  (
    select state from public.listing_tour_upload_intents
    where idempotency_key = '00000000-0000-4000-8000-000000009410'
  ),
  'uploaded',
  'late exact-object confirmation advances the intent exactly once'
);

select * from extensions.finish();
rollback;
