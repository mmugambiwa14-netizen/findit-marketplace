-- 0007_verification_and_moderation.sql
-- Replaces: VerificationRequest, Report entities.
-- Per agreed plan: verification is Core Infrastructure (kept in full). The
-- content-moderation *queue* (Report) is kept; only the automatic AI-flagging
-- step is disabled (see feature flags in docs/FEATURE_FLAGS.md) -- admins
-- review reports manually for MVP.

create table public.verification_requests (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id),
  user_type              verification_user_type not null,
  document_type          verification_document_type not null,
  document_url           text not null,
  trade_document_url     text,
  selfie_url             text,
  status                 verification_status not null default 'pending',

  -- AI-extraction fields kept for schema compatibility; simplified workflow
  -- (see MIGRATION.md) has admins fill verified_* directly instead of relying
  -- on extracted_* from an LLM call. Re-enabling auto-extraction later needs
  -- no schema change.
  extracted_full_name   text,
  extracted_email        text,
  extracted_phone        text,
  extraction_done        boolean not null default false,

  verified_full_name    text,
  verified_email         text,
  verified_phone         text,

  reused_from_id         uuid references public.verification_requests(id),
  rejection_reason       text,
  reviewed_by            uuid references public.users(id),
  reviewed_at             timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_verification_requests_user on public.verification_requests(user_id);
create index idx_verification_requests_status on public.verification_requests(status);

create trigger trg_verification_requests_updated_at
  before update on public.verification_requests
  for each row execute function set_updated_at();

create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid references public.listings(id),
  listing_type       ticket_listing_category,
  listing_title      text,
  reason             report_reason not null,
  description        text,
  reporter_id        uuid not null references public.users(id),
  status             report_status not null default 'pending',
  admin_notes        text,
  reviewed_by        uuid references public.users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_reports_status on public.reports(status, created_at desc);
create index idx_reports_listing on public.reports(listing_id);
