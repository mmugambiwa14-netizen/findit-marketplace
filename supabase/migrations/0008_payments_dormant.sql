-- 0008_payments_dormant.sql
-- Replaces: Payment, EscrowTransaction, Subscription, PractitionerPayout entities.
--
-- IMPORTANT: Per agreed direction, payments are DISABLED for MVP launch but
-- NOT deleted. These tables are created now, fully normalized, so re-enabling
-- payments later (Phase 5+) is a matter of:
--   1. flipping the `payments_enabled` feature flag (docs/FEATURE_FLAGS.md)
--   2. wiring a real Stripe/Ecocash/InnBucks gateway integration
--   3. un-hiding the relevant routes/nav in the frontend
-- No further schema migration should be needed for that cutover.

create table public.payments (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users(id),
  amount_usd                  numeric(14,2) not null,
  currency                    text not null default 'USD',
  payment_type                payment_type not null,
  status                      payment_status not null default 'pending',
  stripe_payment_intent_id    text,
  reference_id                text,
  description                 text,
  paid_at                     timestamptz,
  refunded_at                 timestamptz,
  refund_reason               text,
  created_at                  timestamptz not null default now()
);

create index idx_payments_user on public.payments(user_id);

create table public.escrow_transactions (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null,  -- polymorphic: service_bookings or legal_bookings; resolved in Phase 5
  gross_amount_usd          numeric(14,2) not null,
  platform_fee_usd         numeric(14,2),
  net_amount_usd            numeric(14,2),
  payment_method            payment_method,
  paynow_reference          text,
  stripe_payment_intent_id  text,
  escrow_status             escrow_status not null default 'pending',
  held_at                   timestamptz,
  release_triggered_at      timestamptz,
  released_at               timestamptz,
  refunded_at               timestamptz,
  payout_reference          text,
  payout_method             text,
  admin_notes               text,
  created_at                timestamptz not null default now()
);

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.users(id),
  plan_name                 subscription_plan not null,
  status                    subscription_status not null default 'active',
  billing_cycle             text not null check (billing_cycle in ('monthly', 'yearly')),
  price_usd                 numeric(14,2) not null,
  started_at                timestamptz,
  next_billing_date         timestamptz,
  cancelled_at               timestamptz,
  cancellation_reason        text,
  stripe_subscription_id    text,
  created_at                timestamptz not null default now()
);

create index idx_subscriptions_user on public.subscriptions(user_id);

create table public.practitioner_payouts (
  id                 uuid primary key default gen_random_uuid(),
  practitioner_id    uuid not null references public.legal_practitioners(id),
  booking_id         uuid not null references public.legal_bookings(id),
  amount_usd         numeric(14,2) not null,
  payout_method      payment_method not null,
  status             payout_status not null default 'pending',
  paynow_reference   text,
  failure_reason     text,
  initiated_at       timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_practitioner_payouts_practitioner on public.practitioner_payouts(practitioner_id);
