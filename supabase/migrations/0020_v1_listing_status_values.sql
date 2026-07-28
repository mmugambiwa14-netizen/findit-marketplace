-- 0020_v1_listing_status_values.sql
-- Adds the explicit owner/moderation states approved for the V1 listing
-- lifecycle. Enum values are committed in their own migration because
-- PostgreSQL cannot safely use newly added enum values in the same transaction.

alter type public.listing_status add value if not exists 'pending_review' after 'draft';
alter type public.listing_status add value if not exists 'rejected' after 'pending_review';
alter type public.listing_status add value if not exists 'paused' after 'available';
alter type public.listing_status add value if not exists 'unavailable' after 'paused';
