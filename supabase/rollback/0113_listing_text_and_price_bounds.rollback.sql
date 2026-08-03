-- 0113_listing_text_and_price_bounds.rollback.sql
--
-- Removes the database-level length and price bounds on listings and services.
-- Client contracts still bound these values, but that validation runs in the
-- browser: after this rollback a direct PostgREST call can store a
-- 200,000-character title again.
--
-- No data is lost -- dropping a CHECK never rewrites rows.

alter table public.listings
  drop constraint if exists listings_title_length,
  drop constraint if exists listings_description_length,
  drop constraint if exists listings_seller_name_length,
  drop constraint if exists listings_price_upper_bound;

alter table public.services
  drop constraint if exists services_title_length,
  drop constraint if exists services_description_length,
  drop constraint if exists services_provider_name_length,
  drop constraint if exists services_price_upper_bound;
