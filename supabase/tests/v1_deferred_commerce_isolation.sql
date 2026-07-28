begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'payments',
        'escrow_transactions',
        'subscriptions',
        'practitioner_payouts'
      )
  ),
  0::bigint,
  'deferred commerce tables expose no browser RLS policies'
);

select extensions.is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in (
        'payments',
        'escrow_transactions',
        'subscriptions',
        'practitioner_payouts'
      )
  ),
  0::bigint,
  'deferred commerce tables grant no privileges to browser roles'
);

select extensions.ok(
  has_table_privilege('service_role', 'public.payments', 'select')
    and has_table_privilege('service_role', 'public.escrow_transactions', 'select')
    and has_table_privilege('service_role', 'public.subscriptions', 'select')
    and has_table_privilege('service_role', 'public.practitioner_payouts', 'select'),
  'service role retains future commerce reconciliation access'
);

set local role anon;
select extensions.throws_ok(
  $$select count(*) from public.payments$$,
  '42501',
  'permission denied for table payments',
  'anonymous callers cannot access deferred payments'
);

reset role;
set local role authenticated;
select extensions.throws_ok(
  $$select count(*) from public.subscriptions$$,
  '42501',
  'permission denied for table subscriptions',
  'authenticated callers cannot access deferred subscriptions'
);

reset role;
select * from extensions.finish();
rollback;
