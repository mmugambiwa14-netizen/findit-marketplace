-- 0011_rls_policies.sql
-- Enforces authorization at the database level, replacing Base44's
-- "requiresAuth"/callable-function checks with real RLS. This is one of the
-- concrete security upgrades over the Base44 baseline (see MIGRATION.md,
-- security section): admin-only actions like ban/promote/verify are no longer
-- just "a function that checks a flag" -- the database itself refuses the
-- write if the policy doesn't match, regardless of which code path calls it.

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and (role = 'admin' or super_admin = true)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.users where id = auth.uid() and super_admin = true
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;

create policy "users_select_own_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());

create policy "users_update_own_profile_fields" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());
  -- Note: role/super_admin/status/verified changes must go through a
  -- SECURITY DEFINER function (Phase 2) that re-checks is_admin() itself --
  -- a bare RLS "with check" can't restrict which *columns* a user changes.

create policy "users_admin_manage" on public.users
  for update using (public.is_admin());

-- RLS controls which rows may be updated, not which columns. Preserve direct
-- self-service edits to display profile fields while preventing an ordinary
-- authenticated user from changing identity, verification, phone-security,
-- role, super-admin, suspension, or ban state on their own row.
create or replace function public.protect_user_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.phone is distinct from old.phone
    or new.phone_verified is distinct from old.phone_verified
    or new.phone_otp_code is distinct from old.phone_otp_code
    or new.phone_otp_pending is distinct from old.phone_otp_pending
    or new.phone_otp_expires is distinct from old.phone_otp_expires
    or new.verified is distinct from old.verified
    or new.verified_at is distinct from old.verified_at
    or new.verified_full_name is distinct from old.verified_full_name
    or new.super_admin is distinct from old.super_admin
    or new.status is distinct from old.status
    or new.ban_reason is distinct from old.ban_reason
    or new.ban_until is distinct from old.ban_until
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'privileged user fields require a trusted server operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_users_protect_managed_fields
  before update on public.users
  for each row execute function public.protect_user_managed_fields();

-- ---------------------------------------------------------------------------
-- listings (+ detail tables inherit visibility via the listing they belong to)
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.car_details enable row level security;
alter table public.property_details enable row level security;
alter table public.machinery_details enable row level security;

create policy "listings_public_read_available" on public.listings
  for select using (status in ('available', 'under_offer', 'rented') or seller_id = auth.uid() or public.is_admin());

create policy "listings_owner_write" on public.listings
  for insert with check (seller_id = auth.uid());

create policy "listings_owner_update" on public.listings
  for update using (seller_id = auth.uid() or public.is_admin());

create policy "listings_owner_delete" on public.listings
  for delete using (seller_id = auth.uid() or public.is_admin());

create policy "car_details_follow_listing" on public.car_details
  for select using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "car_details_owner_write" on public.car_details
  for insert with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "car_details_owner_update" on public.car_details
  for update using (exists (select 1 from public.listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())));

create policy "property_details_follow_listing" on public.property_details
  for select using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "property_details_owner_write" on public.property_details
  for insert with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "property_details_owner_update" on public.property_details
  for update using (exists (select 1 from public.listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())));

create policy "machinery_details_follow_listing" on public.machinery_details
  for select using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "machinery_details_owner_write" on public.machinery_details
  for insert with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "machinery_details_owner_update" on public.machinery_details
  for update using (exists (select 1 from public.listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())));

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
alter table public.services enable row level security;

create policy "services_public_read_active" on public.services
  for select using (status = 'active' or provider_id = auth.uid() or public.is_admin());

create policy "services_owner_write" on public.services
  for insert with check (provider_id = auth.uid());

create policy "services_owner_update" on public.services
  for update using (provider_id = auth.uid() or public.is_admin());

alter table public.service_bookings enable row level security;

create policy "service_bookings_participants" on public.service_bookings
  for select using (user_id = auth.uid() or public.is_admin());

create policy "service_bookings_create" on public.service_bookings
  for insert with check (user_id = auth.uid());

create policy "service_bookings_update" on public.service_bookings
  for update using (user_id = auth.uid() or public.is_admin());

alter table public.service_disputes enable row level security;

create policy "service_disputes_participants" on public.service_disputes
  for select using (raised_by = auth.uid() or public.is_admin());

create policy "service_disputes_create" on public.service_disputes
  for insert with check (raised_by = auth.uid());

-- ---------------------------------------------------------------------------
-- legal practitioner system
-- ---------------------------------------------------------------------------
alter table public.legal_practitioners enable row level security;
alter table public.legal_specializations enable row level security;
alter table public.legal_bookings enable row level security;
alter table public.practitioner_reviews enable row level security;

create policy "legal_practitioners_public_read" on public.legal_practitioners
  for select using (true);

create policy "legal_practitioners_self_update" on public.legal_practitioners
  for update using (user_id = auth.uid() or public.is_admin());

create policy "legal_specializations_public_read" on public.legal_specializations
  for select using (true);

create policy "legal_bookings_participants" on public.legal_bookings
  for select using (
    client_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.legal_practitioners p where p.id = practitioner_id and p.user_id = auth.uid())
  );

create policy "legal_bookings_create" on public.legal_bookings
  for insert with check (client_id = auth.uid());

create policy "practitioner_reviews_public_read" on public.practitioner_reviews
  for select using (true);

create policy "practitioner_reviews_create" on public.practitioner_reviews
  for insert with check (reviewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- social / engagement
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;
alter table public.saved_listings enable row level security;
alter table public.reviews enable row level security;
alter table public.seller_ratings enable row level security;
alter table public.inquiries enable row level security;
alter table public.app_alerts enable row level security;
alter table public.business_profiles enable row level security;

create policy "follows_owner_all" on public.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy "saved_listings_owner_all" on public.saved_listings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reviews_public_read" on public.reviews for select using (true);
create policy "reviews_create" on public.reviews for insert with check (reviewer_id = auth.uid());

create policy "seller_ratings_public_read" on public.seller_ratings for select using (true);
create policy "seller_ratings_create" on public.seller_ratings for insert with check (buyer_id = auth.uid());

create policy "inquiries_participants" on public.inquiries
  for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "inquiries_create" on public.inquiries
  for insert with check (sender_id = auth.uid());

create policy "app_alerts_owner_read" on public.app_alerts for select using (user_id = auth.uid());
create policy "app_alerts_owner_update" on public.app_alerts for update using (user_id = auth.uid());

create policy "business_profiles_public_read" on public.business_profiles for select using (true);
create policy "business_profiles_owner_write" on public.business_profiles
  for insert with check (user_id = auth.uid());
create policy "business_profiles_owner_update" on public.business_profiles
  for update using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- verification & moderation
-- ---------------------------------------------------------------------------
alter table public.verification_requests enable row level security;
alter table public.reports enable row level security;

create policy "verification_requests_owner_or_admin" on public.verification_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "verification_requests_create" on public.verification_requests
  for insert with check (user_id = auth.uid());
create policy "verification_requests_admin_review" on public.verification_requests
  for update using (public.is_admin());

create policy "reports_admin_read" on public.reports for select using (public.is_admin() or reporter_id = auth.uid());
create policy "reports_create" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_admin_update" on public.reports for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- support
-- ---------------------------------------------------------------------------
alter table public.support_agents enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_activity_log enable row level security;
alter table public.ticket_templates enable row level security;
alter table public.support_settings enable row level security;

create policy "support_agents_admin_only" on public.support_agents
  for all using (public.is_admin()) with check (public.is_admin());

create policy "ticket_templates_admin_only" on public.ticket_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "support_settings_admin_only" on public.support_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "support_tickets_owner_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support_tickets_create" on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy "support_tickets_update" on public.support_tickets
  for update using (user_id = auth.uid() or public.is_admin());

create policy "support_messages_ticket_participants" on public.support_messages
  for select using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin()))
  );
create policy "support_messages_create" on public.support_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "ticket_attachments_participants" on public.ticket_attachments
  for select using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin()))
  );

create policy "ticket_attachments_create" on public.ticket_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
    and (
      message_id is null
      or exists (
        select 1 from public.support_messages m
        where m.id = message_id and m.ticket_id = ticket_id
      )
    )
  );

create policy "ticket_activity_log_admin_only" on public.ticket_activity_log
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- payments (dormant, but RLS is on from day one)
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.practitioner_payouts enable row level security;

create policy "payments_owner_or_admin" on public.payments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "subscriptions_owner_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "escrow_admin_only" on public.escrow_transactions
  for select using (public.is_admin());
create policy "payouts_admin_only" on public.practitioner_payouts
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin-only tables
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
create policy "audit_logs_admin_only" on public.audit_logs for select using (public.is_admin());

alter table public.admin_teams enable row level security;
create policy "admin_teams_admin_only" on public.admin_teams for all using (public.is_admin());

alter table public.user_presence enable row level security;
create policy "user_presence_authenticated_read" on public.user_presence
  for select using (auth.uid() is not null);
create policy "user_presence_owner_insert" on public.user_presence
  for insert with check (user_id = auth.uid());
create policy "user_presence_owner_update" on public.user_presence
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reference/content tables: public read, admin write
-- ---------------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.neighbourhoods enable row level security;
alter table public.faqs enable row level security;
alter table public.announcements enable row level security;
alter table public.terms enable row level security;
alter table public.email_templates enable row level security;

create policy "locations_public_read" on public.locations for select using (true);
create policy "locations_admin_write" on public.locations for insert with check (public.is_admin());
create policy "locations_admin_update" on public.locations for update using (public.is_admin());

create policy "neighbourhoods_public_read" on public.neighbourhoods for select using (status = 'published' or public.is_admin());
create policy "neighbourhoods_admin_write" on public.neighbourhoods for all using (public.is_admin());

create policy "faqs_public_read" on public.faqs for select using (status = 'published' or public.is_admin());
create policy "faqs_admin_write" on public.faqs for all using (public.is_admin());

create policy "announcements_public_read" on public.announcements for select using (status = 'active' or public.is_admin());
create policy "announcements_admin_write" on public.announcements for all using (public.is_admin());

create policy "terms_public_read" on public.terms for select using (status = 'published' or public.is_admin());
create policy "terms_admin_write" on public.terms for all using (public.is_admin());

create policy "email_templates_admin_only" on public.email_templates for all using (public.is_admin());
