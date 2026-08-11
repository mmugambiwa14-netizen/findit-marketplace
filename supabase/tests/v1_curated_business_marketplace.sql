begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'curated-approved@example.test', '{"full_name":"Approved Publisher"}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'curated-unapproved@example.test', '{"full_name":"Unapproved Publisher"}', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'curated-admin@example.test', '{"full_name":"Curated Admin"}', now(), now());

update public.users set role = 'admin' where id = '41000000-0000-4000-8000-000000000003';

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '41000000-0000-4000-8000-000000000101',
  '41000000-0000-4000-8000-000000000001',
  'Approved Cars Test', 'Approved Publisher', 'curated-approved@example.test', '+263700000001',
  'ZW', 'Harare', 'A complete test business used for curated marketplace publication certification.', '1-10', 'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values
  ('41000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'car', 'approved'),
  ('41000000-0000-4000-8000-000000000202', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'property', 'pending'),
  ('41000000-0000-4000-8000-000000000203', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'service', 'approved');

select extensions.ok(
  not has_function_privilege('anon', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'anonymous users cannot invoke business application submission'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'authenticated users can invoke business application submission'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.admin_review_business_application(uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot invoke admin review RPCs'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'private.notify_business_category_change()', 'EXECUTE'),
  'notification trigger function is not directly executable by browser users'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select extensions.lives_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000498', 'car',
      '41000000-0000-4000-8000-000000000002', 'Trusted backend',
      'Trusted backend listing fixture',
      'A disposable listing proving that the explicit service-role backend boundary remains usable.',
      1, 'USD', 1, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  'service-role backend can seed a listing without impersonating a browser user'
);
select extensions.lives_ok(
  $$insert into public.services (
      id, provider_id, provider_name, title, description, category,
      subcategory, subcategories, pricing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000499',
      '41000000-0000-4000-8000-000000000002', 'Trusted backend',
      'Trusted backend service fixture',
      'A disposable service proving that the explicit service-role backend boundary remains usable.',
      'mechanic', 'maintenance_repair', '["maintenance_repair"]'::jsonb, 'quote', 'paused'
    )$$,
  'service-role backend can seed a service without impersonating a browser user'
);
reset role;
select set_config('request.jwt.claim.role', '', true);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.ok(public.can_publish_in_category('car'), 'approved Cars publisher passes the category gate');
select extensions.ok(not public.can_publish_in_category('property'), 'pending Property category does not pass the gate');
select extensions.ok(public.can_publish_in_category('service'), 'approved Services publisher passes the category gate');
reset role;

-- Real listing insert through the authoritative table boundary.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select extensions.lives_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000401', 'car',
      '41000000-0000-4000-8000-000000000001', 'Approved Publisher',
      'Approved curated vehicle',
      'A complete certification listing proving that an approved Cars publisher can cross the authoritative database boundary.',
      15000, 'USD', 15000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  'approved matching-category listing insert succeeds'
);

select extensions.throws_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000402', 'property',
      '41000000-0000-4000-8000-000000000001', 'Approved Publisher',
      'Blocked curated property',
      'A complete certification listing that must fail because Property remains pending for this publisher.',
      90000, 'USD', 90000, 'USD', '[]'::jsonb, 'house_sale', 'sale', 'draft'
    )$$,
  '42501',
  'Business category is not approved for publishing',
  'cross-category listing insert is rejected'
);

select extensions.throws_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000403', 'car',
      '41000000-0000-4000-8000-000000000002', 'Spoofed Publisher',
      'Spoofed curated vehicle',
      'A complete certification listing that must fail because the authenticated actor is impersonating another seller.',
      14000, 'USD', 14000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  '42501',
  'Listing publisher identity mismatch',
  'spoofed listing owner is rejected'
);

-- Real service insert through the direct service table path.
select extensions.lives_ok(
  $$insert into public.services (
      id, provider_id, provider_name, title, description, category,
      subcategories, currency, photos, status
    ) values (
      '41000000-0000-4000-8000-000000000501',
      '41000000-0000-4000-8000-000000000001', 'Approved Publisher',
      'Approved mechanic service',
      'A complete certification service proving an approved Services publisher can use the direct insert path.',
      'mechanic', '[]'::jsonb, 'USD', '[]'::jsonb, 'active'
    )$$,
  'approved Services publisher insert succeeds'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select extensions.throws_ok(
  $$insert into public.services (
      id, provider_id, provider_name, title, description, category,
      subcategories, currency, photos, status
    ) values (
      '41000000-0000-4000-8000-000000000502',
      '41000000-0000-4000-8000-000000000002', 'Unapproved Publisher',
      'Blocked mechanic service',
      'A complete certification service that must fail because this user has no Services approval.',
      'mechanic', '[]'::jsonb, 'USD', '[]'::jsonb, 'active'
    )$$,
  '42501',
  'Business category is not approved for publishing',
  'unapproved Services publisher insert is rejected'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
update public.business_category_approvals
set status = 'suspended', reviewer_message = 'Certification suspension', updated_at = clock_timestamp()
where id = '41000000-0000-4000-8000-000000000201';

set local role authenticated;
select extensions.ok(not public.can_publish_in_category('car'), 'suspended category immediately loses publishing access');
reset role;

select extensions.throws_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000404', 'car',
      '41000000-0000-4000-8000-000000000001', 'Approved Publisher',
      'Suspended curated vehicle',
      'A complete certification listing that must fail immediately after the Cars category is suspended.',
      13000, 'USD', 13000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  '42501',
  'Business category is not approved for publishing',
  'suspended category cannot publish a new listing'
);

-- A suspension is a moderation decision: the applicant must not be able to
-- clear it, or erase the reviewer message explaining it, by re-requesting the
-- category through the additional-category flow.
set local role authenticated;
select extensions.throws_ok(
  $$select public.request_additional_business_categories(array['car'])$$,
  '42501',
  'Suspended categories cannot be re-requested',
  'a suspended category cannot be re-requested by the applicant'
);
select extensions.ok(
  exists (
    select 1
    from public.get_my_publishing_access() access
    cross join lateral unnest(access.suspended_categories) as suspended_category
    where suspended_category = 'car'
  ),
  'publishing access reports the suspended category so it is never offered back'
);
reset role;

select extensions.is(
  (select status from public.business_category_approvals
   where id = '41000000-0000-4000-8000-000000000201'),
  'suspended',
  'the suspended category survives an additional-category request'
);

select extensions.is(
  (select reviewer_message from public.business_category_approvals
   where id = '41000000-0000-4000-8000-000000000201'),
  'Certification suspension',
  'the suspension reviewer message is preserved'
);

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '41000000-0000-4000-8000-000000000001'
     and event_type = 'business_category_updated'
     and link = '/post'),
  1::bigint,
  'category status change creates one in-app notification'
);

insert into public.managed_listing_requests (
  id, requester_user_id, category, owner_name, contact_email, contact_phone,
  country_code, city, item_summary, status
) values (
  '41000000-0000-4000-8000-000000000301',
  '41000000-0000-4000-8000-000000000002',
  'machinery', 'Managed Owner', 'managed@example.test', '+263700000002',
  'ZW', 'Harare', 'A managed excavator listing request used to certify operational notifications.', 'submitted'
);

update public.managed_listing_requests
set status = 'needs_information', reviewer_message = 'Please provide the machine serial number.', updated_at = clock_timestamp()
where id = '41000000-0000-4000-8000-000000000301';

select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '41000000-0000-4000-8000-000000000002'
     and event_type = 'managed_listing_updated'
     and link = '/post'),
  1::bigint,
  'managed listing status change creates one in-app notification'
);

select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'listings'
      and trigger_name = 'listings_enforce_curated_publisher'
  ),
  'authoritative listing publication trigger exists'
);
select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'services'
      and trigger_name = 'services_enforce_curated_publisher'
  ),
  'authoritative service publication trigger exists'
);

select * from extensions.finish();
rollback;
