-- 0029_v1_deferred_commerce_isolation.sql
-- Phase 5 for the approved MVP means safely disabling commerce, not launching
-- a payment product. Preserve normalized rows for future reconciliation while
-- exposing no payment, escrow, subscription, or payout table to browser roles.

begin;

alter table public.payments enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.practitioner_payouts enable row level security;

drop policy if exists "payments_owner_or_admin" on public.payments;
drop policy if exists "payments_admin_only" on public.payments;
drop policy if exists "subscriptions_owner_or_admin" on public.subscriptions;
drop policy if exists "subscriptions_admin_only" on public.subscriptions;
drop policy if exists "escrow_admin_only" on public.escrow_transactions;
drop policy if exists "payouts_admin_only" on public.practitioner_payouts;

revoke all on table
  public.payments,
  public.escrow_transactions,
  public.subscriptions,
  public.practitioner_payouts
from anon, authenticated;

comment on table public.payments is
  'Future commerce domain. No anon/authenticated V1 privileges or policies.';
comment on table public.escrow_transactions is
  'Future commerce domain. No anon/authenticated V1 privileges or policies.';
comment on table public.subscriptions is
  'Future commerce domain. No anon/authenticated V1 privileges or policies.';
comment on table public.practitioner_payouts is
  'Future legal/commerce domain. No anon/authenticated V1 privileges or policies.';

commit;
