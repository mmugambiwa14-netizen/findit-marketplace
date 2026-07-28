-- 0013_v1_rls_hardening.sql
-- Closes Phase 1 authorization gaps for the approved V1 data surface and
-- fails closed for deferred tables. This migration is additive and preserves
-- all retained data.

create or replace function public.is_active_user()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and status = 'active'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and status = 'active'
      and (role = 'admin' or super_admin = true)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and status = 'active' and super_admin = true
  );
$$ language sql stable security definer set search_path = public;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core listing and service ownership
-- ---------------------------------------------------------------------------

drop policy if exists "listings_public_read_available" on public.listings;
drop policy if exists "listings_owner_write" on public.listings;
drop policy if exists "listings_owner_update" on public.listings;
drop policy if exists "listings_owner_delete" on public.listings;

create policy "listings_public_read_available" on public.listings
  for select using (
    status in ('available', 'under_offer', 'rented')
    or (public.is_active_user() and seller_id = auth.uid())
    or public.is_admin()
  );
create policy "listings_owner_write" on public.listings
  for insert with check (public.is_active_user() and seller_id = auth.uid());
create policy "listings_owner_update" on public.listings
  for update using (
    public.is_active_user() and (seller_id = auth.uid() or public.is_admin())
  ) with check (
    public.is_active_user() and (seller_id = auth.uid() or public.is_admin())
  );
create policy "listings_owner_delete" on public.listings
  for delete using (
    public.is_active_user() and (seller_id = auth.uid() or public.is_admin())
  );

create or replace function public.protect_listing_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.seller_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.kind is distinct from old.kind
    or new.seller_id is distinct from old.seller_id
    or new.verified is distinct from old.verified
    or new.views is distinct from old.views
    or new.created_via is distinct from old.created_via
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'listing-managed fields require a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_listings_protect_managed_fields
  before update on public.listings
  for each row execute function public.protect_listing_managed_fields();

drop policy if exists "car_details_owner_write" on public.car_details;
drop policy if exists "car_details_owner_update" on public.car_details;
drop policy if exists "property_details_owner_write" on public.property_details;
drop policy if exists "property_details_owner_update" on public.property_details;
drop policy if exists "machinery_details_owner_write" on public.machinery_details;
drop policy if exists "machinery_details_owner_update" on public.machinery_details;

create policy "car_details_owner_write" on public.car_details
  for insert with check (public.is_active_user() and exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
  ));
create policy "car_details_owner_update" on public.car_details
  for update using (public.is_active_user() and exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())
  ));
create policy "property_details_owner_write" on public.property_details
  for insert with check (public.is_active_user() and exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
  ));
create policy "property_details_owner_update" on public.property_details
  for update using (public.is_active_user() and exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())
  ));
create policy "machinery_details_owner_write" on public.machinery_details
  for insert with check (public.is_active_user() and exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
  ));
create policy "machinery_details_owner_update" on public.machinery_details
  for update using (public.is_active_user() and exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())
  ));

drop policy if exists "services_public_read_active" on public.services;
drop policy if exists "services_owner_write" on public.services;
drop policy if exists "services_owner_update" on public.services;

create policy "services_public_read_active" on public.services
  for select using (
    status = 'active'
    or (public.is_active_user() and provider_id = auth.uid())
    or public.is_admin()
  );
create policy "services_owner_write" on public.services
  for insert with check (public.is_active_user() and provider_id = auth.uid());
create policy "services_owner_update" on public.services
  for update using (
    public.is_active_user() and (provider_id = auth.uid() or public.is_admin())
  ) with check (
    public.is_active_user() and (provider_id = auth.uid() or public.is_admin())
  );

create or replace function public.protect_service_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.provider_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.provider_id is distinct from old.provider_id
    or new.verified is distinct from old.verified
    or new.views is distinct from old.views
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'service-managed fields require a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_services_protect_managed_fields
  before update on public.services
  for each row execute function public.protect_service_managed_fields();

-- New writes must satisfy basic numeric integrity without invalidating unknown
-- historical rows during an upgrade. Validation follows after reconciliation.
alter table public.listings add constraint listings_price_nonnegative
  check (price >= 0) not valid;
alter table public.listings add constraint listings_views_nonnegative
  check (views >= 0) not valid;
alter table public.car_details add constraint car_details_mileage_nonnegative
  check (mileage is null or mileage >= 0) not valid;
alter table public.car_details add constraint car_details_year_plausible
  check (year is null or year between 1900 and 2100) not valid;
alter table public.property_details add constraint property_details_counts_nonnegative
  check ((bedrooms is null or bedrooms >= 0) and (bathrooms is null or bathrooms >= 0)) not valid;
alter table public.property_details add constraint property_details_size_positive
  check (size_sqm is null or size_sqm > 0) not valid;
alter table public.machinery_details add constraint machinery_details_usage_nonnegative
  check (usage_hours is null or usage_hours >= 0) not valid;
alter table public.machinery_details add constraint machinery_details_year_plausible
  check (year is null or year between 1900 and 2100) not valid;
alter table public.services add constraint services_price_nonnegative
  check (price is null or price >= 0) not valid;
alter table public.services add constraint services_views_nonnegative
  check (views >= 0) not valid;

-- ---------------------------------------------------------------------------
-- Favourites, messaging, notifications, business profiles and reports
-- ---------------------------------------------------------------------------

drop policy if exists "saved_listings_owner_all" on public.saved_listings;
create policy "saved_listings_owner_read" on public.saved_listings
  for select using (public.is_active_user() and user_id = auth.uid());
create policy "saved_listings_owner_insert" on public.saved_listings
  for insert with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('available', 'under_offer', 'rented')
    )
  );
create policy "saved_listings_owner_delete" on public.saved_listings
  for delete using (public.is_active_user() and user_id = auth.uid());

drop policy if exists "inquiries_participants" on public.inquiries;
drop policy if exists "inquiries_create" on public.inquiries;
create policy "inquiries_participants" on public.inquiries
  for select using (
    public.is_active_user()
    and (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin())
  );
create policy "inquiries_create" on public.inquiries
  for insert with check (
    public.is_active_user()
    and sender_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1 from public.listings l
      where l.id = inquiries.listing_id
        and l.seller_id = inquiries.seller_id
    )
    and (
      (
        buyer_id = auth.uid()
        and exists (
          select 1 from public.listings l
          where l.id = inquiries.listing_id
            and l.status in ('available', 'under_offer', 'rented')
        )
      )
      or (
        seller_id = auth.uid()
        and exists (
          select 1 from public.inquiries prior
          where prior.conversation_id = inquiries.conversation_id
            and prior.listing_id = inquiries.listing_id
            and prior.buyer_id = inquiries.buyer_id
            and prior.seller_id = inquiries.seller_id
        )
      )
    )
  );

drop policy if exists "app_alerts_owner_read" on public.app_alerts;
drop policy if exists "app_alerts_owner_update" on public.app_alerts;
create policy "app_alerts_owner_read" on public.app_alerts
  for select using (public.is_active_user() and user_id = auth.uid());
create policy "app_alerts_owner_update" on public.app_alerts
  for update using (public.is_active_user() and user_id = auth.uid())
  with check (public.is_active_user() and user_id = auth.uid());

create or replace function public.protect_alert_fields()
returns trigger as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.type is distinct from old.type
    or new.link is distinct from old.link
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'notification content requires a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_app_alerts_protect_fields
  before update on public.app_alerts
  for each row execute function public.protect_alert_fields();

drop policy if exists "business_profiles_public_read" on public.business_profiles;
drop policy if exists "business_profiles_owner_write" on public.business_profiles;
drop policy if exists "business_profiles_owner_update" on public.business_profiles;
create policy "business_profiles_owner_read" on public.business_profiles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "business_profiles_owner_write" on public.business_profiles
  for insert with check (
    public.is_active_user()
    and user_id = auth.uid()
    and verified = false
    and verification_status = 'none'
  );
create policy "business_profiles_owner_update" on public.business_profiles
  for update using (
    public.is_active_user() and (user_id = auth.uid() or public.is_admin())
  ) with check (
    public.is_active_user() and (user_id = auth.uid() or public.is_admin())
  );

create or replace function public.protect_business_profile_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.registration_number is distinct from old.registration_number
    or new.issuing_body is distinct from old.issuing_body
    or new.verified is distinct from old.verified
    or new.verification_status is distinct from old.verification_status
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'business-profile managed fields require a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_business_profiles_protect_managed_fields
  before update on public.business_profiles
  for each row execute function public.protect_business_profile_managed_fields();

drop view if exists public.business_profiles_public;
create view public.business_profiles_public with (security_barrier = true) as
  select
    id,
    user_id,
    company_name,
    business_type,
    phone,
    email,
    website,
    city,
    address,
    description,
    avatar_url,
    created_at,
    updated_at
  from public.business_profiles;
revoke all on public.business_profiles_public from public;
grant select on public.business_profiles_public to anon, authenticated;
revoke select on public.business_profiles from anon;

drop policy if exists "reports_admin_read" on public.reports;
drop policy if exists "reports_create" on public.reports;
drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_reporter_or_admin_read" on public.reports
  for select using (
    public.is_active_user() and (reporter_id = auth.uid() or public.is_admin())
  );
create policy "reports_create" on public.reports
  for insert with check (
    public.is_active_user()
    and reporter_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status in ('available', 'under_offer', 'rented')
    )
  );
create policy "reports_admin_update" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Active reference data and durable audit helper
-- ---------------------------------------------------------------------------

drop policy if exists "locations_public_read" on public.locations;
create policy "locations_public_read" on public.locations
  for select using (is_active or public.is_admin());

drop policy if exists "audit_logs_admin_only" on public.audit_logs;
create policy "audit_logs_admin_only" on public.audit_logs
  for select using (public.is_admin());

create or replace function public.write_audit_log(
  action_name text,
  target_id text default null,
  target_type text default null,
  before_snapshot jsonb default null,
  after_snapshot jsonb default null
)
returns uuid as $$
declare
  audit_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if action_name is null or length(trim(action_name)) = 0 then
    raise exception 'audit action is required' using errcode = '22023';
  end if;
  insert into public.audit_logs (
    admin_user_id,
    action_performed,
    target_record_id,
    target_record_type,
    before_values,
    after_values
  ) values (
    auth.uid(),
    left(trim(action_name), 200),
    target_id,
    target_type,
    before_snapshot,
    after_snapshot
  ) returning id into audit_id;
  return audit_id;
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function public.write_audit_log(text, text, text, jsonb, jsonb) from public;
grant execute on function public.write_audit_log(text, text, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Deferred V1 tables: ordinary users fail closed; admins retain read/ops for
-- preservation and future reconciliation where required.
-- ---------------------------------------------------------------------------

drop policy if exists "service_bookings_participants" on public.service_bookings;
drop policy if exists "service_bookings_create" on public.service_bookings;
drop policy if exists "service_bookings_update" on public.service_bookings;
create policy "service_bookings_admin_only" on public.service_bookings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "service_disputes_participants" on public.service_disputes;
drop policy if exists "service_disputes_create" on public.service_disputes;
create policy "service_disputes_admin_only" on public.service_disputes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "legal_practitioners_public_read" on public.legal_practitioners;
drop policy if exists "legal_practitioners_self_update" on public.legal_practitioners;
create policy "legal_practitioners_admin_only" on public.legal_practitioners
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "legal_specializations_public_read" on public.legal_specializations;
create policy "legal_specializations_admin_only" on public.legal_specializations
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "legal_bookings_participants" on public.legal_bookings;
drop policy if exists "legal_bookings_create" on public.legal_bookings;
create policy "legal_bookings_admin_only" on public.legal_bookings
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "practitioner_reviews_public_read" on public.practitioner_reviews;
drop policy if exists "practitioner_reviews_create" on public.practitioner_reviews;
create policy "practitioner_reviews_admin_only" on public.practitioner_reviews
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "follows_owner_all" on public.follows;
create policy "follows_admin_only" on public.follows
  for select using (public.is_admin());
drop policy if exists "reviews_public_read" on public.reviews;
drop policy if exists "reviews_create" on public.reviews;
create policy "reviews_admin_only" on public.reviews
  for select using (public.is_admin());
drop policy if exists "seller_ratings_public_read" on public.seller_ratings;
drop policy if exists "seller_ratings_create" on public.seller_ratings;
create policy "seller_ratings_admin_only" on public.seller_ratings
  for select using (public.is_admin());

drop policy if exists "verification_requests_owner_or_admin" on public.verification_requests;
drop policy if exists "verification_requests_create" on public.verification_requests;
drop policy if exists "verification_requests_admin_review" on public.verification_requests;
create policy "verification_requests_admin_only" on public.verification_requests
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "support_tickets_owner_or_admin" on public.support_tickets;
drop policy if exists "support_tickets_create" on public.support_tickets;
drop policy if exists "support_tickets_update" on public.support_tickets;
create policy "support_tickets_admin_only" on public.support_tickets
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "support_messages_ticket_participants" on public.support_messages;
drop policy if exists "support_messages_create" on public.support_messages;
create policy "support_messages_admin_only" on public.support_messages
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ticket_attachments_participants" on public.ticket_attachments;
drop policy if exists "ticket_attachments_create" on public.ticket_attachments;
create policy "ticket_attachments_admin_only" on public.ticket_attachments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payments_owner_or_admin" on public.payments;
create policy "payments_admin_only" on public.payments
  for select using (public.is_admin());
drop policy if exists "subscriptions_owner_or_admin" on public.subscriptions;
create policy "subscriptions_admin_only" on public.subscriptions
  for select using (public.is_admin());

drop policy if exists "user_presence_authenticated_read" on public.user_presence;
drop policy if exists "user_presence_owner_insert" on public.user_presence;
drop policy if exists "user_presence_owner_update" on public.user_presence;
create policy "user_presence_admin_only" on public.user_presence
  for all using (public.is_admin()) with check (public.is_admin());
