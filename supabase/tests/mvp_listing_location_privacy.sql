begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000009001',
  'privacy-owner@example.test',
  '{"full_name":"Privacy Owner"}',
  now(),
  now()
);

insert into public.locations (
  id,
  name,
  type,
  parent_id,
  country_code,
  latitude,
  longitude,
  provider_name,
  provider_place_id,
  is_active
)
values (
  '00000000-0000-4000-8000-000000009101',
  'Exact provider result',
  'suburb',
  '00000000-0000-4000-8000-000000000101',
  'ZW',
  -17.801234,
  31.091234,
  'test-provider',
  'exact-place',
  true
);

-- Fixture setup, but it still crosses the authoritative curated publisher
-- boundary exactly as runtime does. Auth is opened only for this insert and
-- cleared before any assertion runs.
insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
)
values (
  '00000000-0000-4000-8000-000000009501',
  '00000000-0000-4000-8000-000000009001',
  'Location Privacy Estates',
  'Privacy Owner',
  'privacy-owner@example.test',
  '+263700000001',
  'ZW',
  'Harare',
  'Approved fixture business used only to certify this suite''s boundaries.',
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
    'property',
    'approved'
  );

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000009001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (
  id,
  kind,
  seller_id,
  seller_name,
  title,
  description,
  price,
  category,
  status,
  location_id,
  latitude,
  longitude,
  public_latitude,
  public_longitude,
  content_suspended_at
)
values
  (
    '00000000-0000-4000-8000-000000009201',
    'property',
    '00000000-0000-4000-8000-000000009001',
    'Privacy Owner',
    'Approximate public location test',
    'A test listing that must publish only its parent city coordinates.',
    100000,
    'house_sale',
    'available',
    '00000000-0000-4000-8000-000000009101',
    -17.801234,
    31.091234,
    -17.801234,
    31.091234,
    null
  ),
  (
    '00000000-0000-4000-8000-000000009202',
    'property',
    '00000000-0000-4000-8000-000000009001',
    'Privacy Owner',
    'Suspended public location test',
    'A suspended test listing that must not be visible to public callers.',
    100000,
    'house_sale',
    'available',
    '00000000-0000-4000-8000-000000009101',
    -17.801234,
    31.091234,
    -17.801234,
    31.091234,
    now()
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select extensions.is(
  (select public_latitude from public.listings where id = '00000000-0000-4000-8000-000000009201'),
  -17.825166::numeric,
  'public latitude resolves to the parent city'
);
select extensions.is(
  (select public_longitude from public.listings where id = '00000000-0000-4000-8000-000000009201'),
  31.033510::numeric,
  'public longitude resolves to the parent city'
);
select extensions.is(
  (select exact_latitude from public.listing_private_locations where listing_id = '00000000-0000-4000-8000-000000009201'),
  -17.801234::numeric,
  'exact latitude is retained in the private location table'
);
select extensions.is(
  (select exact_longitude from public.listing_private_locations where listing_id = '00000000-0000-4000-8000-000000009201'),
  31.091234::numeric,
  'exact longitude is retained in the private location table'
);
select extensions.is(
  has_table_privilege('anon', 'public.listings', 'select'),
  false,
  'anonymous callers do not have broad listing table select'
);
select extensions.is(
  has_column_privilege('anon', 'public.listings', 'public_latitude', 'select'),
  true,
  'anonymous callers can read the locality-level latitude'
);
select extensions.is(
  has_column_privilege('anon', 'public.listings', 'latitude', 'select'),
  false,
  'anonymous callers cannot read exact listing latitude'
);
select extensions.is(
  has_column_privilege('authenticated', 'public.listings', 'moderation_reason', 'select'),
  false,
  'authenticated callers cannot enumerate listing moderation notes'
);

set local role anon;
select extensions.results_eq(
  $$select id from public.listings where id = '00000000-0000-4000-8000-000000009201'$$,
  $$values ('00000000-0000-4000-8000-000000009201'::uuid)$$,
  'anonymous callers can read an unsuspended available listing'
);
select extensions.is_empty(
  $$select id from public.listings where id = '00000000-0000-4000-8000-000000009202'$$,
  'anonymous callers cannot read a content-suspended listing'
);
select extensions.is_empty(
  $$select id from public.locations where id = '00000000-0000-4000-8000-000000009101'$$,
  'anonymous callers cannot enumerate unpromoted provider locations'
);
select extensions.throws_matching(
  $$select latitude from public.listings where id = '00000000-0000-4000-8000-000000009201'$$,
  '.*permission denied for table listings.*',
  'anonymous callers cannot request the legacy exact latitude column'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009001', true);
set local role authenticated;
select extensions.results_eq(
  $$select id from public.owner_listing_notes(array['00000000-0000-4000-8000-000000009201'::uuid])$$,
  $$values ('00000000-0000-4000-8000-000000009201'::uuid)$$,
  'an owner can read review metadata only for their requested listing'
);

select extensions.finish();
rollback;
