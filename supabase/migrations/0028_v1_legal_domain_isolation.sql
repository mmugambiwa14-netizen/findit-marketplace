-- 0028_v1_legal_domain_isolation.sql
-- The approved V1 product has no lawyer directory, legal profiles, bookings,
-- reviews, payouts, verification or legal administration. Preserve historical
-- rows for reconciliation, but expose no legal-domain browser contract.

drop policy if exists "legal_practitioners_admin_only" on public.legal_practitioners;
drop policy if exists "legal_specializations_admin_only" on public.legal_specializations;
drop policy if exists "legal_bookings_admin_only" on public.legal_bookings;
drop policy if exists "practitioner_reviews_admin_only" on public.practitioner_reviews;
drop policy if exists "payouts_admin_only" on public.practitioner_payouts;

revoke all on table
  public.legal_practitioners,
  public.legal_specializations,
  public.legal_bookings,
  public.practitioner_reviews,
  public.practitioner_payouts
from anon, authenticated;

-- `services` remains an active V1 marketplace table, so legal rows must be
-- excluded in the database rather than relying on UI/repository filters.
-- Existing legal rows stay available to the service role for migration and
-- future-version reconciliation.
drop policy if exists "services_public_read_active" on public.services;
drop policy if exists "services_owner_write" on public.services;
drop policy if exists "services_owner_update" on public.services;
drop policy if exists "services_owner_delete" on public.services;

create policy "services_public_read_active" on public.services
  for select using (
    category <> 'legal'
    and (
      status = 'active'
      or (public.is_active_user() and provider_id = auth.uid())
      or public.is_admin()
    )
  );

create policy "services_owner_write" on public.services
  for insert with check (
    public.is_active_user()
    and provider_id = auth.uid()
    and category <> 'legal'
    and verified = false
    and views = 0
    and photos = '[]'::jsonb
  );

create policy "services_owner_update" on public.services
  for update using (
    category <> 'legal'
    and public.is_active_user()
    and (provider_id = auth.uid() or public.is_admin())
  ) with check (
    category <> 'legal'
    and public.is_active_user()
    and (provider_id = auth.uid() or public.is_admin())
  );

create policy "services_owner_delete" on public.services
  for delete using (
    category <> 'legal'
    and public.is_active_user()
    and (provider_id = auth.uid() or public.is_admin())
  );

comment on table public.legal_practitioners is
  'Future-version legal domain. No anon/authenticated V1 table privileges or policies.';
comment on table public.legal_specializations is
  'Future-version legal domain. No anon/authenticated V1 table privileges or policies.';
comment on table public.legal_bookings is
  'Future-version legal domain. No anon/authenticated V1 table privileges or policies.';
comment on table public.practitioner_reviews is
  'Future-version legal domain. No anon/authenticated V1 table privileges or policies.';
comment on table public.practitioner_payouts is
  'Future-version legal/payment domain. No anon/authenticated V1 table privileges or policies.';
