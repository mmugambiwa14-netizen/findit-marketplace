begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'property_details' and column_name = 'property_type'),
  'text',
  'property type storage is widened beyond the legacy enum'
);
select extensions.is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'car_details' and column_name = 'fuel_type'),
  'text',
  'vehicle fuel storage is widened beyond the legacy enum'
);
select extensions.is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'car_details' and column_name = 'transmission'),
  'text',
  'vehicle transmission storage is widened beyond the legacy enum'
);
select extensions.is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'machinery_details' and column_name = 'machinery_type'),
  'text',
  'machinery type storage is widened beyond the legacy enum'
);
select extensions.is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'machinery_details' and column_name = 'condition'),
  'text',
  'machinery condition storage is widened beyond the legacy enum'
);

select extensions.ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_v2_listing_submission'
      and pg_get_function_identity_arguments(p.oid) = 'p_submission_key uuid, p_listing jsonb, p_detail jsonb, p_attributes jsonb, p_media jsonb'
  ),
  'the public V2 submission function is an invoker wrapper'
);
select extensions.ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'create_v2_listing_submission'
      and pg_get_function_identity_arguments(p.oid) = 'p_submission_key uuid, p_listing jsonb, p_detail jsonb, p_attributes jsonb, p_media jsonb'
  ),
  'the privileged V2 submission implementation lives in private'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.create_v2_listing_submission(uuid,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated users can execute the public V2 submission boundary'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.create_v2_listing_submission(uuid,jsonb,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot execute V2 submission'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '85000000-0000-4000-8000-000000000001',
  'listing-v2-owner@example.test',
  '{"full_name":"Listing V2 Owner"}',
  now(),
  now()
);

insert into public.business_category_approvals (user_id, category, status, reviewed_at)
values ('85000000-0000-4000-8000-000000000001', 'car', 'approved', now());

create temporary table listing_v2_fixture (
  intent_id uuid,
  storage_path text,
  listing_id uuid
) on commit drop;

grant select, insert, update on listing_v2_fixture to service_role, authenticated;

set local role service_role;
insert into listing_v2_fixture(intent_id, storage_path)
select
  public.authorize_listing_image_upload(
    '85000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000001/staging/85000000-0000-4000-8000-000000000101.png',
    'image/png', 68, 1, 1, repeat('b', 64)
  ),
  '85000000-0000-4000-8000-000000000001/staging/85000000-0000-4000-8000-000000000101.png';
reset role;

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '85000000-0000-4000-8000-000000000201',
  'listing-images',
  '85000000-0000-4000-8000-000000000001/staging/85000000-0000-4000-8000-000000000101.png',
  '85000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  '{"mimetype":"image/png","size":68}'::jsonb
);

set local role service_role;
select extensions.lives_ok(
  $$select public.complete_listing_image_upload((select intent_id from listing_v2_fixture))$$,
  'the V2 fixture media is completed through the trusted upload boundary'
);
reset role;

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v2_listing_submission(
    '85000000-0000-4000-8000-000000000301',
    '{"kind":"car","title":"2023 plug-in hybrid crossover","description":"A complete vehicle listing proving that the richer schema survives the hardened marketplace submission transaction.","category":"cars_sale","listingType":"sale","price":32000,"currency":"USD","locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Example","model":"PHEV X","year":2023,"mileage":18000,"fuel_type":"plug_in_hybrid","transmission":"cvt","condition":"excellent"}'::jsonb,
    '{"version":1,"values":{"subtype":"suv","service_history":"full","accident_history":"none","spare_keys":2}}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'intentId', (select intent_id from listing_v2_fixture),
      'path', (select storage_path from listing_v2_fixture)
    ))
  )$$,
  'V2 delegates the mature listing transaction and accepts richer registry values'
);
reset role;

update listing_v2_fixture
set listing_id = (
  select id from public.listings
  where submission_key = '85000000-0000-4000-8000-000000000301'
);

select extensions.is(
  (select fuel_type from public.car_details where listing_id = (select listing_id from listing_v2_fixture)),
  'plug_in_hybrid',
  'V2 stores the exact richer fuel value rather than its V1 compatibility projection'
);
select extensions.is(
  (select transmission from public.car_details where listing_id = (select listing_id from listing_v2_fixture)),
  'cvt',
  'V2 stores the exact richer transmission value rather than automatic'
);
select extensions.is(
  (select attributes #>> '{values,subtype}' from public.listings where id = (select listing_id from listing_v2_fixture)),
  'suv',
  'the versioned attributes envelope is persisted with the listing'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok(
  $$select public.create_v2_listing_submission(
    '85000000-0000-4000-8000-000000000301',
    '{"kind":"car","title":"Retry must not edit","description":"A repeated submission key returns the original result and must never become an attribute mutation channel after publication.","category":"cars_sale","listingType":"sale","price":1,"currency":"USD","locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Example","model":"PHEV X","year":2023,"mileage":18000,"fuel_type":"plug_in_hybrid","transmission":"cvt","condition":"excellent"}'::jsonb,
    '{"version":1,"values":{"subtype":"truck"}}'::jsonb,
    '[]'::jsonb
  )$$,
  'an idempotent V2 retry returns the original listing without requiring media again'
);
reset role;

select extensions.is(
  (select attributes #>> '{values,subtype}' from public.listings where id = (select listing_id from listing_v2_fixture)),
  'suv',
  'an idempotent retry cannot mutate the original attributes document'
);

select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.create_v2_listing_submission(
    '85000000-0000-4000-8000-000000000302',
    '{"kind":"car","title":"Invalid fuel value listing","description":"This otherwise valid listing proves that arbitrary client supplied normalized classifications are rejected by V2.","category":"cars_sale","listingType":"sale","price":20000,"currency":"USD","locationId":"00000000-0000-4000-8000-000000000101","contactPhone":"+263771234567"}'::jsonb,
    '{"brand":"Example","model":"Jet","year":2023,"mileage":1,"fuel_type":"jet_fuel","transmission":"automatic","condition":"good"}'::jsonb,
    '{"version":1,"values":{}}'::jsonb,
    '[]'::jsonb
  )$$,
  '22023',
  'unsupported vehicle fuel type',
  'V2 rejects arbitrary normalized classification values before delegation'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.throws_ok(
  $$select public.create_v2_listing_submission(null, '{}'::jsonb, '{}'::jsonb, '{"version":1,"values":{}}'::jsonb, '[]'::jsonb)$$,
  '42501',
  null,
  'anonymous callers are denied at the V2 public boundary'
);
reset role;

select * from extensions.finish();
rollback;
