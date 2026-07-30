-- 0083_foreign_key_covering_indexes.sql
-- Add deterministic B-tree coverage for every foreign key reported as
-- unindexed by the hosted database advisor. These indexes reduce lock duration
-- and table scans during parent updates/deletes and support common joins.

create index if not exists idx_fk_announcements_published_by
  on public.announcements (published_by);
create index if not exists idx_fk_app_alerts_listing_id
  on public.app_alerts (listing_id);
create index if not exists idx_fk_conversation_reports_reporter_id
  on public.conversation_reports (reporter_id);
create index if not exists idx_fk_conversation_reports_reviewed_by
  on public.conversation_reports (reviewed_by);
create index if not exists idx_fk_conversations_last_message_sender_id
  on public.conversations (last_message_sender_id);
create index if not exists idx_fk_notification_fanout_listing_id
  on public.essential_notification_fanout_jobs (listing_id);
create index if not exists idx_fk_inquiries_listing_id
  on public.inquiries (listing_id);
create index if not exists idx_fk_inquiries_sender_id
  on public.inquiries (sender_id);
create index if not exists idx_fk_legal_bookings_listing_id
  on public.legal_bookings (listing_id);
create index if not exists idx_fk_legal_practitioners_user_id
  on public.legal_practitioners (user_id);
create index if not exists idx_fk_listing_media_owner_id
  on public.listing_media (owner_id);
create index if not exists idx_fk_listing_private_locations_owner_id
  on public.listing_private_locations (owner_id);
create index if not exists idx_fk_listing_tour_events_actor_id
  on public.listing_tour_events (actor_id);
create index if not exists idx_fk_listing_tour_slots_pending_tour_id
  on public.listing_tour_slots (pending_tour_id);
create index if not exists idx_fk_locations_promoted_by
  on public.locations (promoted_by);
create index if not exists idx_fk_marketplace_feature_controls_updated_by
  on public.marketplace_feature_controls (updated_by);
create index if not exists idx_fk_marketplace_operational_controls_updated_by
  on public.marketplace_operational_controls (updated_by);
create index if not exists idx_fk_neighbourhoods_created_by
  on public.neighbourhoods (created_by);
create index if not exists idx_fk_practitioner_payouts_booking_id
  on public.practitioner_payouts (booking_id);
create index if not exists idx_fk_practitioner_reviews_booking_id
  on public.practitioner_reviews (booking_id);
create index if not exists idx_fk_practitioner_reviews_reviewer_id
  on public.practitioner_reviews (reviewer_id);
create index if not exists idx_fk_reports_reporter_id
  on public.reports (reporter_id);
create index if not exists idx_fk_reports_reviewed_by
  on public.reports (reviewed_by);
create index if not exists idx_fk_reviews_reviewer_id
  on public.reviews (reviewer_id);
create index if not exists idx_fk_seller_ratings_buyer_id
  on public.seller_ratings (buyer_id);
create index if not exists idx_fk_seller_ratings_listing_id
  on public.seller_ratings (listing_id);
create index if not exists idx_fk_service_bookings_cancelled_by
  on public.service_bookings (cancelled_by);
create index if not exists idx_fk_service_disputes_admin_id
  on public.service_disputes (admin_id);
create index if not exists idx_fk_service_disputes_raised_by
  on public.service_disputes (raised_by);
create index if not exists idx_fk_service_media_owner_id
  on public.service_media (owner_id);
create index if not exists idx_fk_services_base_location_id
  on public.services (base_location_id);
create index if not exists idx_fk_services_location_id
  on public.services (location_id);
create index if not exists idx_fk_support_agents_user_id
  on public.support_agents (user_id);
create index if not exists idx_fk_support_messages_sender_id
  on public.support_messages (sender_id);
create index if not exists idx_fk_support_requests_resolved_by
  on public.support_requests (resolved_by);
create index if not exists idx_fk_support_tickets_listing_id
  on public.support_tickets (listing_id);
create index if not exists idx_fk_terms_last_updated_by
  on public.terms (last_updated_by);
create index if not exists idx_fk_ticket_activity_log_actor_id
  on public.ticket_activity_log (actor_id);
create index if not exists idx_fk_ticket_attachments_message_id
  on public.ticket_attachments (message_id);
create index if not exists idx_fk_ticket_attachments_uploaded_by
  on public.ticket_attachments (uploaded_by);
create index if not exists idx_fk_ticket_templates_team_id
  on public.ticket_templates (team_id);
create index if not exists idx_fk_verification_requests_reused_from_id
  on public.verification_requests (reused_from_id);
create index if not exists idx_fk_verification_requests_reviewed_by
  on public.verification_requests (reviewed_by);
