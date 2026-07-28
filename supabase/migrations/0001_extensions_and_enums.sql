-- 0001_extensions_and_enums.sql
-- Foundational extensions and shared enum types used across the schema.
-- Replaces: Base44's implicit schema validation on each entity's `enum` fields.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy/text search on titles, names

-- ---------------------------------------------------------------------------
-- Shared enums
-- ---------------------------------------------------------------------------

create type user_status as enum ('active', 'suspended', 'banned');

create type listing_kind as enum ('car', 'property', 'machinery');
create type listing_status as enum ('draft', 'available', 'under_offer', 'sold', 'rented', 'expired');
create type listing_created_via as enum ('single', 'csv', 'pdf', 'duplicate', 'template', 'developer');

create type car_fuel_type as enum ('petrol', 'diesel', 'electric', 'hybrid');
create type car_transmission as enum ('manual', 'automatic');

create type property_type as enum ('house', 'apartment', 'land', 'commercial', 'other');

create type machinery_type as enum ('construction', 'agricultural', 'industrial', 'transport', 'other');
create type machinery_condition as enum ('new', 'excellent', 'good', 'fair', 'needs_repair');

create type service_category as enum ('property_developer', 'mechanic', 'legal', 'construction', 'geological');
create type service_pricing_type as enum ('fixed', 'starting_from', 'hourly', 'quote');
create type service_status as enum ('active', 'paused', 'unavailable');

create type inquiry_status as enum ('new', 'delivered', 'read');
create type saved_listing_type as enum ('property', 'car', 'machinery', 'service');
create type alert_type as enum ('new_listing', 'price_drop', 'status_change', 'inquiry_received', 'system');

create type report_reason as enum ('fake', 'scam', 'duplicate', 'inappropriate', 'wrong_price', 'other');
create type report_status as enum ('pending', 'reviewed', 'dismissed', 'actioned');

create type verification_user_type as enum ('individual', 'business', 'legal_practitioner', 'service_provider');
create type verification_document_type as enum ('id', 'business_registration', 'law_license', 'passport', 'trade_certificate');
create type verification_status as enum ('pending', 'approved', 'rejected', 'on_hold');

create type business_type as enum ('real_estate_agency', 'car_dealership', 'heavy_machinery_dealer', 'property_developer', 'legal_firm', 'other');
create type business_verification_status as enum ('none', 'pending', 'verified', 'rejected');

create type legal_practitioner_type as enum ('lawyer', 'conveyancer', 'estate_agent_qualified', 'tax_practitioner', 'notary_public');
create type legal_issuing_body as enum ('law_society_zimbabwe', 'estate_agents_council', 'zimra', 'other');
create type legal_specialization_category as enum ('property', 'vehicle', 'commercial', 'employment', 'general', 'dispute_resolution');
create type legal_booking_status as enum ('pending_payment', 'paid', 'confirmed', 'in_progress', 'awaiting_documents', 'completed', 'disputed', 'cancelled', 'refunded');

create type service_booking_status as enum ('pending_acceptance', 'accepted', 'declined', 'paid', 'in_progress', 'pending_confirmation', 'completed', 'disputed', 'refunded', 'cancelled');
create type service_dispute_reason as enum ('service_not_delivered', 'service_incomplete', 'service_quality', 'wrong_service', 'practitioner_unresponsive', 'other');
create type service_dispute_status as enum ('open', 'under_review', 'resolved_release', 'resolved_refund', 'resolved_partial');

-- Payment-related enums are defined even though the tables stay dormant for MVP
-- (see 0008_payments_dormant.sql) so re-enabling later needs no type changes.
create type payment_method as enum ('ecocash', 'innbucks', 'bank_transfer', 'stripe', 'manual');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type payment_type as enum ('listing_feature', 'subscription', 'legal_booking', 'ad_placement');
create type escrow_status as enum ('pending', 'held', 'releasing', 'released', 'refunded', 'disputed', 'partially_released');
create type subscription_plan as enum ('basic', 'professional', 'premium');
create type subscription_status as enum ('active', 'paused', 'cancelled', 'expired');
create type payout_status as enum ('pending', 'processing', 'completed', 'failed');

create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type ticket_status as enum ('open', 'in_progress', 'waiting_for_user', 'waiting_for_admin', 'resolved', 'closed', 'escalated');
create type ticket_user_type as enum ('individual', 'agent', 'company', 'service_provider');
create type ticket_source as enum ('web', 'mobile_app', 'email', 'whatsapp', 'phone', 'chat');
create type ticket_assigned_team as enum ('general', 'verification', 'payments', 'legal', 'fraud', 'technical');
create type ticket_listing_category as enum ('property', 'vehicle', 'machinery', 'service');
create type ticket_fraud_type as enum ('fake_listing', 'seller_scam', 'payment_fraud', 'identity_theft', 'stolen_goods');
create type ticket_dispute_type as enum ('buyer_wont_pay', 'seller_wont_deliver', 'deposit_dispute', 'contract_breach', 'misrepresentation');
create type ticket_actor_type as enum ('user', 'admin', 'system');
create type ticket_sender_type as enum ('user', 'admin');
create type support_setting_kind as enum ('settings', 'email_template');

create type announcement_type as enum ('info', 'warning', 'critical', 'feature');
create type announcement_audience as enum ('all', 'users', 'sellers', 'admins');
create type announcement_visibility as enum ('current_only', 'current_and_new');
create type announcement_status as enum ('draft', 'scheduled', 'active', 'archived');

create type faq_category as enum ('general', 'selling', 'buying', 'legal', 'technical');
create type content_status as enum ('draft', 'published', 'archived');
create type terms_section as enum ('terms_of_service', 'privacy_policy', 'community_guidelines', 'seller_agreement');

create type location_type as enum ('country', 'province', 'state', 'city', 'town', 'district');

-- updated_at trigger helper, reused by every table below
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
