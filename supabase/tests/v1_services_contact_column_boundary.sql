begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- Regression guard for the services contact-detail harvesting hole.
--
-- Any authenticated user could read raw contact_phone / contact_whatsapp /
-- contact_email straight from public.services, bypassing the reveal RPC, its
-- rate limit and its audit log. The cause was a table-level SELECT grant to
-- authenticated (0047) that a later column revoke (0115) could not narrow -- the
-- same no-op 0111 documented and fixed for anon.
--
-- These assertions check both the grant shape and the live, role-switched
-- behaviour, so a future migration that re-grants a table-level SELECT (which
-- would silently re-expose the columns) fails here.

-- 1. Grant shape ------------------------------------------------------------

select extensions.ok(
  not has_table_privilege('authenticated', 'public.services', 'SELECT'),
  'authenticated holds no table-level SELECT grant on services (a table grant re-exposes every column)'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.services', 'SELECT'),
  'anon holds no table-level SELECT grant on services'
);

select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_phone', 'SELECT'),
  'authenticated cannot read services.contact_phone'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_whatsapp', 'SELECT'),
  'authenticated cannot read services.contact_whatsapp'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_email', 'SELECT'),
  'authenticated cannot read services.contact_email'
);
select extensions.ok(
  not has_column_privilege('anon', 'public.services', 'contact_phone', 'SELECT'),
  'anon cannot read services.contact_phone'
);

-- Marketplace browsing must survive the lock-down.
select extensions.ok(
  has_column_privilege('authenticated', 'public.services', 'title', 'SELECT'),
  'authenticated can still read services.title'
);
select extensions.ok(
  has_column_privilege('authenticated', 'public.services', 'has_contact_phone', 'SELECT'),
  'authenticated can still read the has_contact_phone flag the UI depends on'
);

-- listings parity: the boundary services now matches.
select extensions.ok(
  not has_column_privilege('authenticated', 'public.listings', 'contact_phone', 'SELECT'),
  'authenticated cannot read listings.contact_phone (parity)'
);

-- 2. Live behaviour ---------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('7c000000-0000-4000-8000-000000000001', 'svc-provider@example.test', '{"full_name":"Provider"}', now(), now()),
  ('7c000000-0000-4000-8000-000000000002', 'svc-harvester@example.test', '{"full_name":"Harvester"}', now(), now());

insert into public.services (id, provider_id, title, category, status, contact_phone, contact_whatsapp, contact_email)
values (
  '7c000000-0000-4000-8000-0000000000aa',
  '7c000000-0000-4000-8000-000000000001',
  'Provider mechanic service',
  'mechanic',
  'active',
  '+263771112222',
  '+263779998888',
  'provider-secret@example.test'
);

-- Become a signed-in user who is neither the provider nor a buyer.
select set_config('request.jwt.claim.sub', '7c000000-0000-4000-8000-000000000002', true);
set local role authenticated;

-- The active service row is public, so it stays visible...
select extensions.is(
  (select count(*)::bigint from public.services where id = '7c000000-0000-4000-8000-0000000000aa'),
  1::bigint,
  'an active service remains visible to any authenticated user (browsing works)'
);

-- ...its safe columns stay readable...
select extensions.is(
  (select title from public.services where id = '7c000000-0000-4000-8000-0000000000aa'),
  'Provider mechanic service',
  'the service title is readable'
);

-- ...but every contact column is denied at the column-grant boundary.
select extensions.throws_ok(
  $$select contact_phone from public.services where id = '7c000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table services',
  'a non-provider cannot read a service contact_phone'
);
select extensions.throws_ok(
  $$select contact_whatsapp from public.services where id = '7c000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table services',
  'a non-provider cannot read a service contact_whatsapp'
);
select extensions.throws_ok(
  $$select contact_email from public.services where id = '7c000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table services',
  'a non-provider cannot read a service contact_email'
);

-- The bulk-harvest form is denied for the same reason.
select extensions.throws_ok(
  $$select count(contact_phone) from public.services$$,
  '42501',
  'permission denied for table services',
  'a non-provider cannot bulk-harvest service contact numbers'
);

reset role;

select * from extensions.finish();
rollback;
