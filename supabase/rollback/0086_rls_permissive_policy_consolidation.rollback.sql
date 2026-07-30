-- 0086_rls_permissive_policy_consolidation.rollback.sql
--
-- Restore the pre-0086 broad policy layout exactly. This rollback is intended
-- only for a release-specific forward-fix decision; it deliberately restores
-- the advisor warnings together with the original authorization structure.

create temporary table findit_permissive_policy_rollback_expected (
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  primary key (table_name, policy_name)
) on commit drop;

insert into findit_permissive_policy_rollback_expected (
  table_name,
  policy_name,
  command_name,
  roles_text
)
values
  ('announcements', 'announcements_public_read', 'SELECT', '{public}'),
  ('announcements', 'announcements_admin_insert', 'INSERT', '{public}'),
  ('announcements', 'announcements_admin_update', 'UPDATE', '{public}'),
  ('announcements', 'announcements_admin_delete', 'DELETE', '{public}'),
  ('country_configs', 'country_configs_public_read', 'SELECT', '{public}'),
  ('country_configs', 'country_configs_admin_insert', 'INSERT', '{public}'),
  ('country_configs', 'country_configs_admin_update', 'UPDATE', '{public}'),
  ('country_configs', 'country_configs_admin_delete', 'DELETE', '{public}'),
  ('exchange_rates', 'exchange_rates_public_read', 'SELECT', '{public}'),
  ('exchange_rates', 'exchange_rates_admin_insert', 'INSERT', '{public}'),
  ('exchange_rates', 'exchange_rates_admin_update', 'UPDATE', '{public}'),
  ('exchange_rates', 'exchange_rates_admin_delete', 'DELETE', '{public}'),
  ('faqs', 'faqs_public_read', 'SELECT', '{public}'),
  ('faqs', 'faqs_admin_insert', 'INSERT', '{public}'),
  ('faqs', 'faqs_admin_update', 'UPDATE', '{public}'),
  ('faqs', 'faqs_admin_delete', 'DELETE', '{public}'),
  ('listing_private_locations', 'listing_private_locations_owner_admin_read', 'SELECT', '{public}'),
  ('listing_private_locations', 'listing_private_locations_server_insert', 'INSERT', '{public}'),
  ('listing_private_locations', 'listing_private_locations_server_update', 'UPDATE', '{public}'),
  ('listing_private_locations', 'listing_private_locations_server_delete', 'DELETE', '{public}'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_public_read', 'SELECT', '{public}'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_admin_insert', 'INSERT', '{public}'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_admin_update', 'UPDATE', '{public}'),
  ('marketplace_operational_controls', 'marketplace_operational_controls_admin_delete', 'DELETE', '{public}'),
  ('neighbourhoods', 'neighbourhoods_public_read', 'SELECT', '{public}'),
  ('neighbourhoods', 'neighbourhoods_admin_insert', 'INSERT', '{public}'),
  ('neighbourhoods', 'neighbourhoods_admin_update', 'UPDATE', '{public}'),
  ('neighbourhoods', 'neighbourhoods_admin_delete', 'DELETE', '{public}'),
  ('terms', 'terms_public_read', 'SELECT', '{public}'),
  ('terms', 'terms_admin_insert', 'INSERT', '{public}'),
  ('terms', 'terms_admin_update', 'UPDATE', '{public}'),
  ('terms', 'terms_admin_delete', 'DELETE', '{public}'),
  ('users', 'users_update_own_or_admin', 'UPDATE', '{public}');

do $rollback$
declare
  expected_count integer;
  mismatch_count integer;
begin
  select count(*)::integer
  into expected_count
  from findit_permissive_policy_rollback_expected;

  if expected_count <> 33 then
    raise exception '0086 rollback expected 33 post-change policies, found %', expected_count;
  end if;

  select count(*)::integer
  into mismatch_count
  from findit_permissive_policy_rollback_expected expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.permissive <> 'PERMISSIVE'
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text;

  if mismatch_count <> 0 then
    raise exception '0086 rollback refused because % policy identities drifted', mismatch_count;
  end if;

  drop policy announcements_admin_insert on public.announcements;
  drop policy announcements_admin_update on public.announcements;
  drop policy announcements_admin_delete on public.announcements;
  create policy announcements_admin_write on public.announcements
    for all to public
    using (is_admin());

  drop policy country_configs_admin_insert on public.country_configs;
  drop policy country_configs_admin_update on public.country_configs;
  drop policy country_configs_admin_delete on public.country_configs;
  create policy country_configs_admin_write on public.country_configs
    for all to public
    using (is_admin())
    with check (is_admin());

  drop policy exchange_rates_admin_insert on public.exchange_rates;
  drop policy exchange_rates_admin_update on public.exchange_rates;
  drop policy exchange_rates_admin_delete on public.exchange_rates;
  create policy exchange_rates_admin_write on public.exchange_rates
    for all to public
    using (is_admin())
    with check (is_admin());

  drop policy faqs_admin_insert on public.faqs;
  drop policy faqs_admin_update on public.faqs;
  drop policy faqs_admin_delete on public.faqs;
  create policy faqs_admin_write on public.faqs
    for all to public
    using (is_admin());

  alter policy listing_private_locations_owner_admin_read
    on public.listing_private_locations
    using (
      owner_id = (select auth.uid())
      or is_admin()
    );

  drop policy listing_private_locations_server_insert
    on public.listing_private_locations;
  drop policy listing_private_locations_server_update
    on public.listing_private_locations;
  drop policy listing_private_locations_server_delete
    on public.listing_private_locations;
  create policy listing_private_locations_server_write
    on public.listing_private_locations
    for all to public
    using (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    )
    with check (
      current_user = any (array['postgres'::name, 'service_role'::name])
      or is_admin()
    );

  drop policy marketplace_operational_controls_admin_insert
    on public.marketplace_operational_controls;
  drop policy marketplace_operational_controls_admin_update
    on public.marketplace_operational_controls;
  drop policy marketplace_operational_controls_admin_delete
    on public.marketplace_operational_controls;
  create policy marketplace_operational_controls_admin_write
    on public.marketplace_operational_controls
    for all to public
    using (is_admin())
    with check (is_admin());

  drop policy neighbourhoods_admin_insert on public.neighbourhoods;
  drop policy neighbourhoods_admin_update on public.neighbourhoods;
  drop policy neighbourhoods_admin_delete on public.neighbourhoods;
  create policy neighbourhoods_admin_write on public.neighbourhoods
    for all to public
    using (is_admin());

  drop policy terms_admin_insert on public.terms;
  drop policy terms_admin_update on public.terms;
  drop policy terms_admin_delete on public.terms;
  create policy terms_admin_write on public.terms
    for all to public
    using (is_admin());

  drop policy users_update_own_or_admin on public.users;
  create policy users_admin_manage on public.users
    for update to public
    using (is_admin());
  create policy users_update_own_profile_fields on public.users
    for update to public
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

  select count(*)::integer
  into mismatch_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'announcements_admin_write',
      'country_configs_admin_write',
      'exchange_rates_admin_write',
      'faqs_admin_write',
      'listing_private_locations_server_write',
      'marketplace_operational_controls_admin_write',
      'neighbourhoods_admin_write',
      'terms_admin_write',
      'users_admin_manage',
      'users_update_own_profile_fields'
    );

  if mismatch_count <> 10 then
    raise exception '0086 rollback restored only % of 10 original write policies', mismatch_count;
  end if;
end
$rollback$;
