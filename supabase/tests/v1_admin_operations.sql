begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000002001', 'admin-ops-super@example.test', '{"full_name":"Super Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000002002', 'admin-ops-admin@example.test', '{"full_name":"Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000002003', 'admin-ops-user@example.test', '{"full_name":"Target User"}', now(), now()),
  ('00000000-0000-4000-8000-000000002004', 'admin-ops-reporter@example.test', '{"full_name":"Reporter"}', now(), now());

update public.users set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-000000002001';
update public.users set role = 'admin'
where id = '00000000-0000-4000-8000-000000002002';

insert into public.listings (id, kind, seller_id, seller_name, title, category, price, status)
values (
  '00000000-0000-4000-8000-000000002101', 'car',
  '00000000-0000-4000-8000-000000002003', 'Target User',
  'Admin operation vehicle', 'cars_sale', 12000, 'available'
);
insert into public.car_details (listing_id, brand, model)
values ('00000000-0000-4000-8000-000000002101', 'Toyota', 'Corolla');
insert into public.reports (
  id, listing_id, listing_type, listing_title, reason, reporter_id
)
values (
  '00000000-0000-4000-8000-000000002201',
  '00000000-0000-4000-8000-000000002101', 'vehicle',
  'Admin operation vehicle', 'fake',
  '00000000-0000-4000-8000-000000002004'
);

set local role anon;
select extensions.is(
  (select count(*)::bigint from public.categories where parent_id is null),
  4::bigint,
  'guests can read the four active top-level categories'
);
select extensions.is(
  (select count(*)::bigint from public.categories),
  125::bigint,
  'the V1 taxonomy preserves all approved product and service choices'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002003', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.admin_dashboard_stats()$$,
  '42501', 'admin access required',
  'ordinary users cannot invoke the admin overview'
);
select extensions.throws_ok(
  $$select * from public.admin_category_rows()$$,
  '42501', 'admin access required',
  'ordinary users cannot read the protected category management projection'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
set local role authenticated;
select extensions.throws_ok(
  $$select public.admin_set_user_role(
      '00000000-0000-4000-8000-000000002003', 'admin', 'Operations access'
    )$$,
  '42501', 'super-admin access required',
  'ordinary admins cannot grant the admin role'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
set local role authenticated;

select extensions.is(
  public.admin_dashboard_stats() ->> 'pending_reports',
  '1',
  'admin overview returns the live pending report count'
);
select extensions.is(
  (select count(*)::bigint from public.admin_marketplace_rows('', 'car', 'available', 25, 0)
   where item_id = '00000000-0000-4000-8000-000000002101'),
  1::bigint,
  'marketplace management is server-filtered and includes the fixture'
);
select extensions.is(
  (select count(*)::bigint from public.admin_user_rows('Target', 'user', 'active', 25, 0)
   where user_id = '00000000-0000-4000-8000-000000002003'),
  1::bigint,
  'user management search is server-filtered'
);
select extensions.is(
  (select listing_count from public.admin_category_rows()
   where slug = 'cars_sale' and parent_slug = 'vehicles'),
  1::bigint,
  'category management reports referenced advert counts'
);

select extensions.lives_ok(
  $$select public.admin_set_user_role(
      '00000000-0000-4000-8000-000000002003', 'admin', 'Temporary operations access'
    )$$,
  'a super admin can grant the narrow admin role with a reason'
);
select extensions.is(
  (select role from public.users where id = '00000000-0000-4000-8000-000000002003'),
  'admin',
  'role mutation persisted'
);

select extensions.lives_ok(
  $$select public.admin_set_user_status(
      '00000000-0000-4000-8000-000000002003', 'suspended',
      'Confirmed policy breach', null
    )$$,
  'admin can suspend another account with a reason'
);
select extensions.is(
  (select status::text from public.users where id = '00000000-0000-4000-8000-000000002003'),
  'suspended',
  'account suspension persisted'
);
reset role;
select extensions.is(
  (select count(*)::bigint from public.app_alerts
   where user_id = '00000000-0000-4000-8000-000000002003' and title = 'Account suspended'),
  1::bigint,
  'account access change creates an essential notification'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.admin_review_report(
      '00000000-0000-4000-8000-000000002201', 'reviewed',
      'Manual evidence review complete'
    )$$,
  'admin can record a report decision atomically'
);
select extensions.is(
  (select status::text from public.reports where id = '00000000-0000-4000-8000-000000002201'),
  'reviewed',
  'report decision persisted'
);

select extensions.lives_ok(
  $$select public.admin_moderate_marketplace_item(
      '00000000-0000-4000-8000-000000002101', 'car', 'pause',
      'Paused during manual review'
    )$$,
  'admin can pause an advert through the narrow moderation operation'
);
select extensions.is(
  (select status::text from public.listings where id = '00000000-0000-4000-8000-000000002101'),
  'paused',
  'product pause uses the explicit paused state'
);

select extensions.lives_ok(
  $$select public.admin_update_category(
      (select id from public.categories where parent_id is null and slug = 'vehicles'),
      'Vehicles and transport', 20, true, 'Clearer marketplace label'
    )$$,
  'admin can change a category display label without changing identity'
);
select extensions.is(
  (select slug from public.categories where parent_id is null and display_label = 'Vehicles and transport'),
  'vehicles',
  'display-label changes preserve the stable slug'
);
select extensions.throws_ok(
  $$select public.admin_update_category(
      (select id from public.categories where parent_id is null and slug = 'vehicles'),
      'Vehicles', 20, false, 'Attempt protected deactivation'
    )$$,
  '42501', 'protected top-level categories cannot be deactivated',
  'top-level categories cannot be deactivated'
);

select extensions.is(
  (select count(*)::bigint from public.admin_audit_rows('', 'all', 100, 0)),
  5::bigint,
  'every successful privileged mutation produced a durable audit event'
);
select extensions.is(
  (select count(*)::bigint from public.audit_logs
   where reason is not null and correlation_id is not null and result = 'success'),
  5::bigint,
  'audit events contain reason, correlation, and result evidence'
);

select * from extensions.finish();
rollback;
