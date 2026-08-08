begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'private'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and pg_get_function_result(function_record.oid) = 'jsonb'
      and function_language.lanname = 'sql'
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('seller.id = p_seller_id' in function_record.prosrc) > 0
      and position('seller.status = ''active''' in function_record.prosrc) > 0
      and position('listing.status in (''available'', ''under_offer'')' in function_record.prosrc) > 0
      and position('listing.content_suspended_at is null' in function_record.prosrc) > 0
      and position('private.is_country_browsable(' in function_record.prosrc) > 0
      and position('seller.email' in function_record.prosrc) = 0
  ),
  1::bigint,
  'one locked UUID seller-profile SECURITY DEFINER implementation lives in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join pg_language function_language on function_language.oid = function_record.prolang
    where function_schema.nspname = 'public'
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and pg_get_function_result(function_record.oid) = 'jsonb'
      and function_language.lanname = 'sql'
      and not function_record.prosecdef
      and function_record.provolatile = 's'
      and function_record.proconfig = array['search_path=""']::text[]
      and position('private.get_public_seller_profile(p_seller_id)' in function_record.prosrc) > 0
  ),
  1::bigint,
  'one public UUID seller-profile RPC is a locked SECURITY INVOKER wrapper'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'seller_email text'
  ),
  0::bigint,
  'the legacy public email lookup identity is removed from every schema'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    cross join lateral aclexplode(coalesce(
      function_record.proacl,
      acldefault('f', function_record.proowner)
    )) privilege
    where function_schema.nspname in ('public', 'private')
      and function_record.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_seller_id uuid'
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'no PUBLIC execute grant remains on either UUID seller-profile function'
);

select extensions.ok(
  has_function_privilege('anon', 'public.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_public_seller_profile(uuid)', 'EXECUTE'),
  'public UUID seller-profile wrapper preserves browser and service execution grants'
);

select extensions.ok(
  has_function_privilege('anon', 'private.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.get_public_seller_profile(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'private.get_public_seller_profile(uuid)', 'EXECUTE'),
  'private UUID seller-profile implementation preserves required execution grants'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('90000000-0000-4000-8000-000000000001', 'public-seller@example.test', '{"full_name":"Public Seller"}', now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'seller-without-public-listing@example.test', '{"full_name":"Hidden Seller"}', now(), now()),
  ('90000000-0000-4000-8000-000000000003', 'suspended-public-seller@example.test', '{"full_name":"Suspended Seller"}', now(), now());

update public.users
set full_name = case id
      when '90000000-0000-4000-8000-000000000001'::uuid then 'Public Seller'
      when '90000000-0000-4000-8000-000000000002'::uuid then 'Hidden Seller'
      else 'Suspended Seller'
    end,
    bio = 'seller-profile-boundary-test',
    avatar_url = 'https://example.test/avatar.png',
    status = case
      when id = '90000000-0000-4000-8000-000000000003'::uuid then 'suspended'::public.user_status
      else 'active'::public.user_status
    end
where id in (
  '90000000-0000-4000-8000-000000000001'::uuid,
  '90000000-0000-4000-8000-000000000002'::uuid,
  '90000000-0000-4000-8000-000000000003'::uuid
);

insert into public.locations (id, name, type, country_code)
values ('90000000-0000-4000-8000-000000000010', 'Seller Profile Test City', 'city', 'ZW');

-- The listing fixture must cross the same curated-business trigger as runtime.
-- Give each listing owner an approved Property category, then insert under that
-- owner's authenticated JWT instead of relying on a postgres-only bypass.
insert into public.business_applications (
  id,
  user_id,
  business_name,
  contact_name,
  business_email,
  business_phone,
  country_code,
  city,
  description,
  expected_inventory_band,
  status
) values
  (
    '90000000-0000-4000-8000-000000000021',
    '90000000-0000-4000-8000-000000000001',
    'Public Seller Test Business',
    'Public Seller',
    'public-seller@example.test',
    '+263700000001',
    'ZW',
    'Seller Profile Test City',
    'Approved business fixture for the public seller profile boundary test.',
    '1-10',
    'approved'
  ),
  (
    '90000000-0000-4000-8000-000000000023',
    '90000000-0000-4000-8000-000000000003',
    'Suspended Seller Test Business',
    'Suspended Seller',
    'suspended-public-seller@example.test',
    '+263700000003',
    'ZW',
    'Seller Profile Test City',
    'Approved publishing fixture for the suspended seller visibility test.',
    '1-10',
    'approved'
  );

insert into public.business_category_approvals (
  id,
  business_application_id,
  user_id,
  category,
  status
) values
  (
    '90000000-0000-4000-8000-000000000022',
    '90000000-0000-4000-8000-000000000021',
    '90000000-0000-4000-8000-000000000001',
    'property',
    'approved'
  ),
  (
    '90000000-0000-4000-8000-000000000024',
    '90000000-0000-4000-8000-000000000023',
    '90000000-0000-4000-8000-000000000003',
    'property',
    'approved'
  );

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (id, kind, category, seller_id, title, price, currency, status, location_id, country_code)
values (
  '90000000-0000-4000-8000-000000000011',
  'property',
  'house_sale',
  '90000000-0000-4000-8000-000000000001',
  'Public seller listing',
  100,
  'USD',
  'available',
  '90000000-0000-4000-8000-000000000010',
  'ZW'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.listings (id, kind, category, seller_id, title, price, currency, status, location_id, country_code)
values (
  '90000000-0000-4000-8000-000000000012',
  'property',
  'house_sale',
  '90000000-0000-4000-8000-000000000003',
  'Suspended seller listing',
  100,
  'USD',
  'available',
  '90000000-0000-4000-8000-000000000010',
  'ZW'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

set local role anon;

select extensions.is(
  public.get_public_seller_profile('90000000-0000-4000-8000-000000000001'::uuid),
  jsonb_build_object(
    'id', '90000000-0000-4000-8000-000000000001'::uuid,
    'full_name', 'Public Seller',
    'bio', 'seller-profile-boundary-test',
    'avatar_url', 'https://example.test/avatar.png'
  ),
  'anonymous callers receive only the four public fields for an active seller with a public listing'
);

select extensions.is(
  public.get_public_seller_profile('90000000-0000-4000-8000-000000000002'::uuid),
  null::jsonb,
  'an active account without a publicly eligible listing has no public seller profile'
);

select extensions.is(
  public.get_public_seller_profile('90000000-0000-4000-8000-000000000003'::uuid),
  null::jsonb,
  'a suspended account remains hidden even when an available listing exists'
);

select extensions.is(
  public.get_public_seller_profile(null::uuid),
  null::jsonb,
  'a null opaque seller identifier returns no profile'
);

reset role;

select extensions.finish();
rollback;
