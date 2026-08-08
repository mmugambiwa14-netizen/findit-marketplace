-- 20260808070000_abuse_rate_limit_buckets.rollback.sql
-- Restore the pre-bucket enforcement path without deleting the compact bucket
-- ledger. Existing rolling-query guards remain in their original migrations,
-- so disabling the triggers does not remove the prior abuse controls.

begin;

drop trigger if exists trg_inquiries_abuse_budget on public.inquiries;
drop trigger if exists trg_support_requests_abuse_budget on public.support_requests;
drop trigger if exists trg_listing_upload_intents_abuse_budget on public.listing_upload_intents;
drop trigger if exists trg_marketplace_image_upload_intents_abuse_budget on public.marketplace_image_upload_intents;
drop trigger if exists trg_listing_tour_upload_intents_abuse_budget on public.listing_tour_upload_intents;
drop trigger if exists trg_contact_reveal_events_abuse_budget on public.contact_reveal_events;
drop trigger if exists trg_peek_requests_abuse_budget on public.peek_requests;
drop trigger if exists trg_reports_abuse_budget on public.reports;
drop trigger if exists trg_business_applications_abuse_budget on public.business_applications;
drop trigger if exists trg_managed_listing_requests_abuse_budget on public.managed_listing_requests;

drop function if exists public.prune_abuse_rate_limit_buckets(integer);

drop function if exists private.enforce_inquiry_abuse_budget();
drop function if exists private.enforce_support_request_abuse_budget();
drop function if exists private.enforce_listing_upload_abuse_budget();
drop function if exists private.enforce_marketplace_upload_abuse_budget();
drop function if exists private.enforce_tour_upload_abuse_budget();
drop function if exists private.enforce_contact_reveal_abuse_budget();
drop function if exists private.enforce_peek_request_abuse_budget();
drop function if exists private.enforce_report_abuse_budget();
drop function if exists private.enforce_business_application_abuse_budget();
drop function if exists private.enforce_managed_listing_request_abuse_budget();
drop function if exists private.require_abuse_rate_limit(text, text, integer, integer, text, text, integer);
drop function if exists private.consume_abuse_rate_limit(text, text, integer, integer, integer);

-- Deliberately preserve private.abuse_rate_limit_buckets and its rows. The
-- table contains only hashed subjects and compact counters; keeping it makes
-- rollback non-destructive and preserves incident/abuse evidence for a later
-- forward migration or controlled operational cleanup.

commit;
