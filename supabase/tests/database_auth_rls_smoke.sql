begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(22);

select extensions.is(
  (select count(*)::bigint
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  49::bigint,
  'all 49 application tables exist'
);

select extensions.is(
  (select count(*)::bigint
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity),
  49::bigint,
  'RLS is enabled on all application tables'
);

select extensions.is(
  (select count(*)::bigint
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('cars', 'properties', 'machinery')
     and c.reloptions @> array['security_invoker=true']),
  3::bigint,
  'all listing compatibility views are security invokers'
);

select extensions.is(
  (select p.pronargs::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'enforce_listing_kind'),
  0,
  'listing-kind trigger function has no formal arguments'
);

select extensions.is(
  (select count(*)::bigint
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
     and t.tgname in (
       'trg_car_details_kind',
       'trg_property_details_kind',
       'trg_machinery_details_kind'
     )),
  3::bigint,
  'all three listing-kind triggers exist'
);

select extensions.is(
  (select count(*)::bigint
   from pg_policies
   where schemaname = 'public'
     and policyname in ('neighbourhoods_public_read', 'terms_public_read')
     and qual like '%published%'),
  2::bigint,
  'content policies use the valid published enum value'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-4000-8000-000000000101',
    'document3-user-one@example.test',
    '{"full_name":"Document 3 User One","phone":"+15550000101"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'document3-user-two@example.test',
    '{"full_name":"Document 3 User Two","phone":"+15550000102"}'::jsonb,
    now(),
    now()
  );

select extensions.is(
  (select count(*)::bigint
   from public.users
   where id in (
     '00000000-0000-4000-8000-000000000101',
     '00000000-0000-4000-8000-000000000102'
   )),
  2::bigint,
  'auth inserts create both public profiles'
);

select extensions.is(
  (select full_name from public.users
   where id = '00000000-0000-4000-8000-000000000101'),
  'Document 3 User One',
  'signup trigger copies full name'
);

select extensions.is(
  (select phone from public.users
   where id = '00000000-0000-4000-8000-000000000101'),
  '+15550000101',
  'Phase 2B signup trigger copies phone'
);

insert into public.listings (
  id, kind, seller_id, title, price, status
) values
  (
    '00000000-0000-4000-8000-000000000201',
    'car',
    '00000000-0000-4000-8000-000000000101',
    'Document 3 Draft Car',
    1000,
    'draft'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'car',
    '00000000-0000-4000-8000-000000000101',
    'Document 3 Available Car',
    2000,
    'available'
  );

insert into public.car_details (listing_id, brand)
values
  ('00000000-0000-4000-8000-000000000201', 'Draft Brand'),
  ('00000000-0000-4000-8000-000000000202', 'Available Brand');

set local role anon;

select extensions.is(
  (select count(*)::bigint from public.cars),
  1::bigint,
  'anonymous view caller sees only the public listing'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000102',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.cars),
  1::bigint,
  'unrelated authenticated view caller cannot see the draft listing'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.users),
  1::bigint,
  'ordinary authenticated user sees only their profile'
);

select extensions.is(
  public.is_admin(),
  false,
  'ordinary authenticated user fails the Phase 2C admin-role check'
);

select extensions.is(
  public.is_super_admin(),
  false,
  'ordinary authenticated user fails the Phase 2C super-admin-role check'
);

select extensions.is(
  (select count(*)::bigint from public.cars),
  2::bigint,
  'listing owner sees their public and draft rows through the view'
);

select extensions.lives_ok(
  $$update public.users
    set full_name = 'Document 3 User One Updated'
    where id = '00000000-0000-4000-8000-000000000101'$$,
  'ordinary user may update an allowed profile field'
);

select extensions.throws_ok(
  $$update public.users
    set role = 'admin'
    where id = '00000000-0000-4000-8000-000000000101'$$,
  '42501',
  'privileged user fields require a trusted server operation',
  'ordinary user cannot promote their own role'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

update public.users
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000101';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000101',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::bigint from public.cars),
  2::bigint,
  'admin sees public and draft rows through the view'
);

select extensions.is(
  public.is_admin(),
  true,
  'admin passes the Phase 2C server-side role check'
);

select extensions.is(
  public.is_super_admin(),
  false,
  'admin without the super-admin flag fails the super-admin-role check'
);

select extensions.lives_ok(
  $$update public.users
    set verified = true
    where id = '00000000-0000-4000-8000-000000000102'$$,
  'admin may update another user managed field under current policy'
);

reset role;

select extensions.is(
  (select full_name from public.users
   where id = '00000000-0000-4000-8000-000000000101'),
  'Document 3 User One Updated',
  'allowed profile update persisted inside the test transaction'
);

select * from extensions.finish();

rollback;
