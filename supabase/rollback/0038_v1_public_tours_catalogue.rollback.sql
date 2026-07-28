-- 0038_v1_public_tours_catalogue.rollback.sql
-- Removes only the Milestone 5 feed read model and supporting indexes.

drop function if exists public.public_tour_feed(text, text, text, timestamptz, uuid, integer);
drop index if exists public.idx_listing_tour_slots_current;
drop index if exists public.idx_services_title_trgm;
drop index if exists public.idx_services_location_name_trgm;
drop index if exists public.idx_services_provider_name_trgm;
drop index if exists public.idx_locations_name_trgm;
drop index if exists public.idx_listings_seller_name_trgm;
drop index if exists public.idx_users_full_name_trgm;
