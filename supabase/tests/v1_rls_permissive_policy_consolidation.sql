begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
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
      and cmd = 'ALL'
  ),
  0::bigint,
  'optimized tables contain no broad ALL policies'
);

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
), overlapping as (
  select * from expanded where policy_count > 1
)
select extensions.is(
  (select count(*)::bigint from overlapping),
  0::bigint,
  'optimized tables contain at most one permissive policy per role and action'
);

with admin_write_tables(table_name, prefix) as (
  values
    ('announcements', 'announcements_admin'),
    ('country_configs', 'country_configs_admin'),
    ('exchange_rates', 'exchange_rates_admin'),
    ('faqs', 'faqs_admin'),
    ('marketplace_operational_controls', 'marketplace_operational_controls_admin'),
    ('neighbourhoods', 'neighbourhoods_admin'),
    ('terms', 'terms_admin')
), expected as (
  select table_name, prefix || '_insert' as policy_name, 'INSERT' as command_name from admin_write_tables
  union all
  select table_name, prefix || '_update', 'UPDATE' from admin_write_tables
  union all
  select table_name, prefix || '_delete', 'DELETE' from admin_write_tables
), missing as (
  select expected.*
  from expected
  left join pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
   and policy.cmd = expected.command_name
   and policy.roles::text = '{public}'
  where policy.policyname is null
)
select extensions.is(
  (select count(*)::bigint from missing),
  0::bigint,
  'seven administrative ALL policies are split into 21 explicit write policies'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'listing_private_locations'
      and policyname in (
        'listing_private_locations_server_insert',
        'listing_private_locations_server_update',
        'listing_private_locations_server_delete'
      )
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and roles::text = '{public}'
  ),
  3::bigint,
  'private-location server writes are split into three explicit policies'
);

select extensions.ok(
  (
    select qual ~* 'owner_id = \( SELECT auth\.uid\(\) AS uid\)'
       and qual ~* 'is_admin\(\)'
       and qual ~* 'service_role'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'listing_private_locations'
      and policyname = 'listing_private_locations_owner_admin_read'
      and cmd = 'SELECT'
  ),
  'private-location read preserves owner/admin access and server read compatibility'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd = 'UPDATE'
  ),
  1::bigint,
  'users has one consolidated UPDATE policy'
);

select extensions.ok(
  (
    select qual ~* 'is_admin\(\)'
       and qual ~* 'id = \( SELECT auth\.uid\(\) AS uid\)'
       and with_check ~* 'is_admin\(\)'
       and with_check ~* 'id = \( SELECT auth\.uid\(\) AS uid\)'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_own_or_admin'
      and cmd = 'UPDATE'
      and roles::text = '{public}'
  ),
  'users UPDATE preserves owner-or-admin USING and WITH CHECK semantics'
);

select extensions.is(
  (
    select count(*)::bigint
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
        'terms'
      )
      and cmd = 'SELECT'
  ),
  8::bigint,
  'each read-bearing table retains exactly one SELECT policy'
);

select extensions.finish();
rollback;
