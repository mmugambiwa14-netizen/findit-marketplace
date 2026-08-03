-- 0114_listing_category_attributes.rollback.sql
--
-- Removes the enforcement and the query support added by 0114, while KEEPING
-- the `attributes` columns and their contents.
--
-- Dropping the columns would discard every category-specific answer stored
-- under the schema registry -- property amenities, vehicle service history,
-- machinery capacities, service coverage. A rollback should not destroy user
-- data to undo a constraint, so the columns stay. They are defaulted and
-- ignored by any build that predates 0114, which makes leaving them harmless.
--
-- The normalized columns (bedrooms, mileage, usage_hours and the rest) were
-- never touched by 0114, so listings remain readable and editable either way.
-- That is precisely what the hybrid storage split was chosen to guarantee.
--
-- To remove the columns as well, do it deliberately and separately, after
-- exporting:
--
--   copy (select id, attributes from public.listings
--         where attributes <> '{"version": 1, "values": {}}'::jsonb)
--   to '/tmp/listing_attributes_backup.csv' csv header;

drop index if exists public.idx_listings_attributes_values;
drop index if exists public.idx_services_attributes_values;

alter table public.listings drop constraint if exists listings_attributes_shape;
alter table public.services drop constraint if exists services_attributes_shape;

drop function if exists public.is_valid_attribute_document(jsonb);
