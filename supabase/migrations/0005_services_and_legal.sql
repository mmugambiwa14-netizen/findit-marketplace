-- 0005_services_and_legal.sql
-- Replaces: Service, ServiceBooking, ServiceDispute, LegalPractitioner,
-- LegalSpecialization, LegalBooking, PractitionerReview entities.
-- These are two related but separate systems in the original app and stay
-- separate here to avoid changing the existing workflows.

-- ---------------------------------------------------------------------------
-- General services marketplace (mechanics, construction, geological, etc.)
-- ---------------------------------------------------------------------------

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references public.users(id),
  provider_name     text,
  contact_phone     text,
  contact_whatsapp  text,
  contact_email     text,
  title             text not null,
  description       text,
  category          service_category not null,
  subcategory       text,
  subcategories     jsonb not null default '[]',
  price             numeric(14,2),
  currency          text not null default 'USD',
  pricing_type      service_pricing_type not null default 'fixed',
  photos            jsonb not null default '[]',
  location_id       uuid references public.locations(id),
  location_name     text,
  can_travel        boolean not null default false,
  status            service_status not null default 'active',
  verified          boolean not null default false,
  views             integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_services_provider on public.services(provider_id);
create index idx_services_category_status on public.services(category, status);

create trigger trg_services_updated_at
  before update on public.services
  for each row execute function set_updated_at();

create table public.service_bookings (
  id                        uuid primary key default gen_random_uuid(),
  booking_reference         text not null unique,
  user_id                   uuid not null references public.users(id),
  practitioner_id           uuid, -- references legal_practitioners(id); nullable, see note below
  specialization            text,
  service_title             text not null,
  service_description       text not null,
  user_documents            jsonb not null default '[]',
  quoted_amount_usd         numeric(14,2),
  platform_fee_usd          numeric(14,2),
  net_amount_usd            numeric(14,2),
  platform_fee_percentage   numeric(5,2),
  status                    service_booking_status not null default 'pending_acceptance',
  user_confirmed_at         timestamptz,
  practitioner_confirmed_at timestamptz,
  auto_release_at           timestamptz,
  decline_reason            text,
  cancellation_reason       text,
  cancelled_by              uuid references public.users(id),
  quote_notes               text,
  estimated_timeline        text,
  preferred_timeline        text,
  contact_preference        text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
-- Note: original schema's `practitioner_id` was a bare string with no declared
-- target, used for both LegalPractitioner and general service providers
-- depending on booking type. FK added once that ambiguity is resolved in
-- Phase 2 (tracked in MIGRATION.md as an open item).

create index idx_service_bookings_user on public.service_bookings(user_id);
create index idx_service_bookings_status on public.service_bookings(status);

create trigger trg_service_bookings_updated_at
  before update on public.service_bookings
  for each row execute function set_updated_at();

create table public.service_disputes (
  id                              uuid primary key default gen_random_uuid(),
  booking_id                      uuid not null references public.service_bookings(id) on delete cascade,
  raised_by                       uuid not null references public.users(id),
  dispute_reason                  service_dispute_reason not null,
  dispute_description              text not null,
  user_evidence                   jsonb not null default '[]',
  practitioner_evidence           jsonb not null default '[]',
  status                          service_dispute_status not null default 'open',
  admin_id                        uuid references public.users(id),
  admin_decision                   text,
  admin_decision_reason            text,
  user_release_amount_usd         numeric(14,2),
  practitioner_release_amount_usd numeric(14,2),
  resolved_at                     timestamptz,
  created_at                      timestamptz not null default now()
);

create index idx_service_disputes_booking on public.service_disputes(booking_id);
create index idx_service_disputes_status on public.service_disputes(status);

-- ---------------------------------------------------------------------------
-- Legal practitioner system
-- ---------------------------------------------------------------------------

create table public.legal_specializations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  category     legal_specialization_category not null,
  icon         text,
  active       boolean not null default true
);

create table public.legal_practitioners (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references public.users(id),
  full_name                text not null,
  firm_name                text,
  practitioner_type        legal_practitioner_type not null,
  registration_number      text,
  issuing_body             legal_issuing_body,
  practice_areas           jsonb not null default '[]',
  years_experience         integer,
  city                     text,
  suburb                   text,
  consultation_fee_usd     numeric(14,2),
  bio                      text,
  languages                jsonb not null default '[]',
  avatar_url               text,
  phone                    text,
  whatsapp                 text,
  email                    text,
  verified                 boolean not null default false,
  diaspora_verified        boolean not null default false,
  virtual_consultation     boolean not null default false,
  average_rating           numeric(2,1) default 0,
  total_reviews            integer not null default 0,
  total_cases              integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_legal_practitioners_city on public.legal_practitioners(city);
create index idx_legal_practitioners_type on public.legal_practitioners(practitioner_type);

create trigger trg_legal_practitioners_updated_at
  before update on public.legal_practitioners
  for each row execute function set_updated_at();

create table public.legal_bookings (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.users(id),
  client_name         text,
  practitioner_id     uuid not null references public.legal_practitioners(id),
  practitioner_name   text,
  service_type        text not null,
  listing_id          uuid references public.listings(id),
  listing_title       text,
  booking_status      legal_booking_status not null default 'pending_payment',
  amount_usd          numeric(14,2) not null,
  case_description    text,
  dispute_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_legal_bookings_client on public.legal_bookings(client_id);
create index idx_legal_bookings_practitioner on public.legal_bookings(practitioner_id);

create trigger trg_legal_bookings_updated_at
  before update on public.legal_bookings
  for each row execute function set_updated_at();

create table public.practitioner_reviews (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references public.legal_bookings(id),
  reviewer_id            uuid not null references public.users(id),
  practitioner_id        uuid not null references public.legal_practitioners(id),
  overall_rating         numeric(2,1) not null check (overall_rating between 1 and 5),
  communication_rating   numeric(2,1) check (communication_rating between 1 and 5),
  expertise_rating       numeric(2,1) check (expertise_rating between 1 and 5),
  value_rating           numeric(2,1) check (value_rating between 1 and 5),
  review_text            text,
  practitioner_reply     text,
  created_at             timestamptz not null default now()
);

create index idx_practitioner_reviews_practitioner on public.practitioner_reviews(practitioner_id);
