-- Behaviour coverage for admin-initiated business onboarding and admin
-- publication on behalf of a business. These assertions run the functions
-- rather than reading their source, so a change that keeps the spelling and
-- breaks the decision is caught here.

begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- ---------------------------------------------------------------------------
-- Boundary shape
-- ---------------------------------------------------------------------------
select extensions.ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_onboard_business'),
  'admin_onboard_business runs as a definer boundary'
);
select extensions.is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_onboard_business'),
  array['search_path='],
  'admin_onboard_business pins an empty search path'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.admin_onboard_business(uuid,text,text,text,text,text,text,text,text[],text,text,text,text)', 'execute'),
  'anonymous callers cannot reach admin onboarding'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.admin_create_business_listing(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid)', 'execute'),
  'anonymous callers cannot reach admin publication'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'private.create_listing_submission_for_owner(uuid,uuid,uuid,jsonb,jsonb,jsonb)', 'execute'),
  'the owner-parameterised listing transaction is not client callable'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'private.create_v2_listing_submission_for_owner(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb)', 'execute'),
  'the owner-parameterised V2 submission is not client callable'
);

-- The single-identity entry points must delegate rather than carry a second
-- copy of the listing transaction, or the two will drift.
select extensions.ok(
  (select prosrc like '%create_listing_submission_for_owner%'
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'create_v1_listing_submission'),
  'the V1 entry point delegates to the owner-parameterised transaction'
);
select extensions.ok(
  (select prosrc like '%create_v2_listing_submission_for_owner%'
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'create_v2_listing_submission'),
  'the V2 entry point delegates to the owner-parameterised submission'
);

-- ---------------------------------------------------------------------------
-- Onboarding behaviour
-- ---------------------------------------------------------------------------
-- auth.users insertion mirrors a real signup: handle_new_auth_user() creates the
-- public.users row, which is then promoted for the test.
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at) values
  ('90000000-0000-4000-8000-000000000001', 'onboard-admin@example.test', '{"full_name":"Operator"}', now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'onboard-dealer@example.test', '{"full_name":"Kombi Motors"}', now(), now()),
  ('90000000-0000-4000-8000-000000000003', 'onboard-walkin@example.test', '{"full_name":"Walk In Owner"}', now(), now());

-- is_admin() accepts a non-founder administrator only inside a direct postgres
-- session, which is exactly what a database test is.
update public.users
set role = 'admin', super_admin = true, status = 'active'
where id = '90000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.admin_onboard_business(
      '90000000-0000-4000-8000-000000000002',
      'Kombi Motors', 'Tendai M', 'sales@kombi.example.test', '+263771234567', 'ZW', 'Harare',
      'Family run dealership selling checked used vehicles across Harare province.',
      array['car','machinery'], '11-50', null, null, 'Signed up at the Harare branch')$$,
  'an admin can onboard a business directly'
);

select extensions.is(
  (select status from public.business_applications
   where user_id = '90000000-0000-4000-8000-000000000002'),
  'approved',
  'admin onboarding produces an approved application'
);
select extensions.is(
  (select count(*) from public.business_category_approvals
   where user_id = '90000000-0000-4000-8000-000000000002' and status = 'approved'),
  2::bigint,
  'both requested categories are approved'
);
select extensions.ok(
  exists (select 1 from public.business_review_events
          where action = 'application_onboarded_by_admin'),
  'onboarding is recorded in the business review ledger'
);
-- Re-onboarding must not overwrite what the business wrote about itself.
select public.admin_onboard_business(
  '90000000-0000-4000-8000-000000000002',
  'Overwritten Name', 'Someone Else', 'other@example.test', '+263770000000', 'ZW', 'Bulawayo',
  'A replacement description that must never reach the stored application row.',
  array['property'], '1-10', null, null, 'Added property');

select extensions.is(
  (select business_name from public.business_applications
   where user_id = '90000000-0000-4000-8000-000000000002'),
  'Kombi Motors',
  're-onboarding preserves the business details already on the application'
);
select extensions.is(
  (select count(*) from public.business_applications
   where user_id = '90000000-0000-4000-8000-000000000002'),
  1::bigint,
  're-onboarding reuses the single active application'
);
select extensions.is(
  (select count(*) from public.business_category_approvals
   where user_id = '90000000-0000-4000-8000-000000000002' and status = 'approved'),
  3::bigint,
  're-onboarding adds the newly requested category'
);

select extensions.throws_ok(
  $$select public.admin_onboard_business(
      '90000000-0000-4000-8000-000000000002', 'X', 'Y', 'a@b.test', '+263771111111',
      'ZW', 'Harare', 'A description comfortably longer than twenty characters.',
      array['legal'])$$,
  '22023',
  null,
  'a request naming no supported category is refused'
);

-- ---------------------------------------------------------------------------
-- Whole-application approval
-- ---------------------------------------------------------------------------
select extensions.throws_ok(
  $$select public.admin_review_business_application(
      (select id from public.business_applications
       where user_id = '90000000-0000-4000-8000-000000000002'),
      'delete', 'x')$$,
  'Unsupported review action',
  'unsupported review actions are still refused'
);
select extensions.lives_ok(
  $$select public.admin_review_business_application(
      (select id from public.business_applications
       where user_id = '90000000-0000-4000-8000-000000000002'),
      'approve', 'Verified the trading licence')$$,
  'an application with approved categories can be approved outright'
);
select extensions.ok(
  exists (select 1 from public.business_review_events where action = 'application_approved'),
  'whole-application approval is recorded in the review ledger'
);

-- ---------------------------------------------------------------------------
-- Publication guard rails
-- ---------------------------------------------------------------------------
select extensions.throws_ok(
  $$select public.admin_create_business_listing(
      '90000000-0000-4000-8000-000000000002', gen_random_uuid(),
      jsonb_build_object('kind','car'), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '  ')$$,
  '22023',
  null,
  'publication without a recorded reason is refused'
);
select extensions.throws_ok(
  $$select public.admin_create_business_listing(
      '90000000-0000-4000-8000-000000000002', gen_random_uuid(),
      jsonb_build_object('kind','service'), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      'Services are advertised elsewhere')$$,
  '22023',
  null,
  'publication refuses a kind the listing tables do not carry'
);

select extensions.throws_ok(
  $$select public.admin_create_business_listing(
      '90000000-0000-4000-8000-000000000003', gen_random_uuid(),
      jsonb_build_object('kind','car'), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      'No standing to publish for this account')$$,
  '42501',
  null,
  'publication for an account with no approved category and no managed request is refused'
);

-- Publication marks the named request published, so the request is validated
-- whenever it is named -- including when the business could have published on
-- its own approval and the request belongs to a different owner.
insert into public.managed_listing_requests (
  id, requester_user_id, category, owner_name, contact_email, contact_phone,
  country_code, city, item_summary, status
) values (
  '90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000003', 'car',
  'Walk In Owner', 'walkin@example.test', '+263771234567', 'ZW', 'Harare',
  'A single vehicle the owner asked PeekaListing to advertise on their behalf.', 'accepted'
);

select extensions.throws_ok(
  $$select public.admin_create_business_listing(
      '90000000-0000-4000-8000-000000000002', gen_random_uuid(),
      jsonb_build_object('kind','car'), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      'Approved business naming another owner request',
      '90000000-0000-4000-8000-00000000000a')$$,
  '22023',
  null,
  'an approved business cannot close another owner managed listing request'
);
select extensions.is(
  (select status from public.managed_listing_requests
   where id = '90000000-0000-4000-8000-00000000000a'),
  'accepted',
  'the refused publication leaves the other owner request untouched'
);

reset role;

-- Non-admins reach neither entry point, and see their own publishing standing.
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select extensions.ok(
  public.can_publish_in_category('car'),
  'the onboarded business can publish in the categories it was granted'
);
select extensions.ok(
  not public.can_publish_in_category('service'),
  'onboarding grants only the categories it named'
);
select extensions.throws_ok(
  $$select public.admin_onboard_business(
      '90000000-0000-4000-8000-000000000002', 'X', 'Y', 'a@b.test', '+263771111111',
      'ZW', 'Harare', 'A description comfortably longer than twenty characters.',
      array['car'])$$,
  '42501',
  null,
  'a business cannot onboard itself through the admin boundary'
);
select extensions.throws_ok(
  $$select public.admin_create_business_listing(
      '90000000-0000-4000-8000-000000000002', gen_random_uuid(),
      jsonb_build_object('kind','car'), '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'Self publication')$$,
  '42501',
  null,
  'a business cannot publish through the admin boundary'
);
reset role;

-- The audit ledger is read back as postgres: audit_logs carries no client
-- select grant, so asserting it under the authenticated role would fail on
-- privileges rather than on the row being absent.
select extensions.ok(
  exists (select 1 from public.audit_logs where action_performed = 'business.onboard'),
  'onboarding is recorded in the admin audit log'
);
select extensions.ok(
  exists (select 1 from public.audit_logs where action_performed = 'business.application_approve'),
  'whole-application approval is recorded in the admin audit log'
);

select * from extensions.finish();
rollback;
