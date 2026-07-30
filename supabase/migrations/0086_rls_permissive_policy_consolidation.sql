-- 0086_rls_permissive_policy_consolidation.sql
--
-- Remove overlapping permissive-policy evaluation without changing access.
-- Broad administrative/server FOR ALL policies currently participate in SELECT
-- checks alongside dedicated read policies. Split them into explicit INSERT,
-- UPDATE and DELETE policies, preserve the one read policy per table, and merge
-- the two equivalent users UPDATE paths into a single owner-or-admin policy.
--
-- This migration fails closed on the exact 18 pre-change policy identities and
-- expressions present after migration 0085.

create temporary table findit_permissive_policy_expected (
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  qual_md5 text not null,
  with_check_md5 text not null,
  primary key (table_name, policy_name)
) on commit drop;

insert into findit_permissive_policy_expected (
  table_name,
  policy_name,
  command_name,
  roles_text,
  qual_md5,
  with_check_md5
)
values
  ('announcements', 'announcements_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('announcements', 'announcements_public_read', 'SELECT', '{public}', 'b007d903cee3c0f1554646f749fc0490', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('country_configs', 'country_configs_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', '5533b5b0c6cb6bc41c771c2f6a2c8f37'),
  ('country_configs', 'country_configs_public_read', 'SELECT', '{public}', 'b326b5062b2f0e69046810717534cb09', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('exchange_rates', 'exchange_rates_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', '5533b5b0c6cb6bc41c771c2f6a2c8f37'),
  ('exchange_rates', 'exchange_rates_public_read', 'SELECT', '{public}', 'b326b5062b2f0e69046810717534cb09', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('faqs', 'faqs_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('faqs', 'faqs_public_read', 'SELECT', '{public}', '8a8eda9e094e374ff4585e50d5034d6d', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_private_locations', 'listing_private_locations_owner_admin_read', 'SELECT', '{public}', '02967ad3d041d219d7d640a4ddfd8e64', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('listing_private_locations', 'listing_private_locations_server_write', 'ALL', '{public}', '470c2ee168cc67780586707a22ac9ec7', '470c2ee168cc67780586707a22ac9ec7'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', '5533b5b0c6cb6bc41c771c2f6a2c8f37'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_public_read', 'SELECT', '{public}', 'b326b5062b2f0e69046810717534cb09', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('neighbourhoods', 'neighbourhoods_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('neighbourhoods', 'neighbourhoods_public_read', 'SELECT', '{public}', '8a8eda9e094e374ff4585e50d5034d6d', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('terms', 'terms_admin_write', 'ALL', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('terms', 'terms_public_read', 'SELECT', '{public}', '8a8eda9e094e374ff4585e50d5034d6d', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('users', 'users_admin_manage', 'UPDATE', '{public}', '5533b5b0c6cb6bc41c771c2f6a2c8f37', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('users', 'users_update_own_profile_fields', 'UPDATE', '{public}', '15c587ac9e0e9db4618a46c0502f35aa', '15c587ac9e0e9db4618a46c0502f35aa');

do $migration$
declare
  expected_count integer;
  mismatch_count integer;
  overlapping_count integer;
begin
  select count(*)::integer
  into expected_count
  from findit_permissive_policy_expected;

  if expected_count <> 18 then
    raise exception '0086 expected 18 locked pre-change policies, found %', expected_count;
  end if;

  select count(*)::integer
  into mismatch_count
  from findit_permissive_policy_expected expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.permissive <> 'PERMISSIVE'
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text
     or md5(coalesce(policy.qual, '')) <> expected.qual_md5
     or md5(coalesce(policy.with_check, '')) <> expected.with_check_md5;

  if mismatch_count <> 0 then
    raise exception '0086 refused because % policy fingerprints drifted', mismatch_count;
  end if;

  drop policy announcements_admin_write on public.announcements;
  create policy announcements_admin_insert on public.announcements
    for insert to public
    with check (is_admin());
  create policy announcements_admin_update on public.announcements
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy announcements_admin_delete on public.announcements
    for delete to public
    using (is_admin());

  drop policy country_configs_admin_write on public.country_configs;
  create policy country_configs_admin_insert on public.country_configs
    for insert to public
    with check (is_admin());
  create policy country_configs_admin_update on public.country_configs
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy country_configs_admin_delete on public.country_configs
    for delete to public
    using (is_admin());

  drop policy exchange_rates_admin_write on public.exchange_rates;
  create policy exchange_rates_admin_insert on public.exchange_rates
    for insert to public
    with check (is_admin());
  create policy exchange_rates_admin_update on public.exchange_rates
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy exchange_rates_admin_delete on public.exchange_rates
    for delete to public
    using (is_admin());

  drop policy faqs_admin_write on public.faqs;
  create policy faqs_admin_insert on public.faqs
    for insert to public
    with check (is_admin());
  create policy faqs_admin_update on public.faqs
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy faqs_admin_delete on public.faqs
    for delete to public
    using (is_admin());

  alter policy listing_private_locations_owner_admin_read
    on public.listing_private_locations
    using (
      owner_id = (select auth.uid())
      or is_admin()
      or current_user = any (array['postgres'::name, 'service_role'::name])
    );

  drop policy listing_private_locations_server_write
    on public.listing_private_locations;
  create policy listing_private_locations_server_insert
    on public.listing_private_locations
    for insert to public
    with check (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    );
  create policy listing_private_locations_server_update
    on public.listing_private_locations
    for update to public
    using (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    )
    with check (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    );
  create policy listing_private_locations_server_delete
    on public.listing_private_locations
    for delete to public
    using (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    );

  drop policy marketplace_operational_controls_admin_write
    on public.marketplace_operational_controls;
  create policy marketplace_operational_controls_admin_insert
    on public.marketplace_operational_controls
    for insert to public
    with check (is_admin());
  create policy marketplace_operational_controls_admin_update
    on public.marketplace_operational_controls
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy marketplace_operational_controls_admin_delete
    on public.marketplace_operational_controls
    for delete to public
    using (is_admin());

  drop policy neighbourhoods_admin_write on public.neighbourhoods;
  create policy neighbourhoods_admin_insert on public.neighbourhoods
    for insert to public
    with check (is_admin());
  create policy neighbourhoods_admin_update on public.neighbourhoods
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy neighbourhoods_admin_delete on public.neighbourhoods
    for delete to public
    using (is_admin());

  drop policy terms_admin_write on public.terms;
  create policy terms_admin_insert on public.terms
    for insert to public
    with check (is_admin());
  create policy terms_admin_update on public.terms
    for update to public
    using (is_admin())
    with check (is_admin());
  create policy terms_admin_delete on public.terms
    for delete to public
    using (is_admin());

  drop policy users_admin_manage on public.users;
  drop policy users_update_own_profile_fields on public.users;
  create policy users_update_own_or_admin on public.users
    for update to public
    using (
      is_admin()
      or id = (select auth.uid())
    )
    with check (
      is_admin()
      or id = (select auth.uid())
    );

  select count(*)::integer
  into mismatch_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'announcements',
      'country_configs',
      'exchange_rates',
      'faqs',
      'listing_private_locations',
      'marketplace_operational_controls',
      'neighbourhoods',
      'terms',
      'users'
    )
    and cmd = 'ALL';

  if mismatch_count <> 0 then
    raise exception '0086 left % broad ALL policies on optimized tables', mismatch_count;
  end if;

  with expanded as (
    select tablename,
           role_name,
           command_name,
           count(*) as policy_count
    from pg_policies policy
    cross join lateral unnest(policy.roles) as role_name
    cross join lateral unnest(
      case policy.cmd
        when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
        else array[policy.cmd]::text[]
      end
    ) as command_name
    where policy.schemaname = 'public'
      and policy.permissive = 'PERMISSIVE'
      and policy.tablename in (
        'announcements',
        'country_configs',
        'exchange_rates',
        'faqs',
        'listing_private_locations',
        'marketplace_operational_controls',
        'neighbourhoods',
        'terms',
        'users'
      )
    group by tablename, role_name, command_name
  )
  select count(*)::integer
  into overlapping_count
  from expanded
  where policy_count > 1;

  if overlapping_count <> 0 then
    raise exception '0086 left % overlapping permissive role/action groups', overlapping_count;
  end if;

  select count(*)::integer
  into mismatch_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'users'
    and cmd = 'UPDATE';

  if mismatch_count <> 1 then
    raise exception '0086 expected one users UPDATE policy, found %', mismatch_count;
  end if;
end
$migration$;
