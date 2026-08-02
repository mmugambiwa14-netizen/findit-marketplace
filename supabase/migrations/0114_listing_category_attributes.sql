-- 0114_listing_category_attributes.sql
--
-- Storage half of the listing-domain schema registry (Part III §2 and §9).
--
-- Hybrid model. The existing normalized columns -- property_details.bedrooms,
-- car_details.mileage, machinery_details.usage_hours and the rest -- are the
-- high-traffic, always-present, filterable facts. They stay exactly as they
-- are, so existing listings, cards, filters and read models keep working with
-- no data migration and no rollback risk.
--
-- The sparse, subtype-conditional long tail (borehole, staff quarters, loading
-- bays, spare keys, tyre condition, digging depth) becomes one validated
-- `attributes` document per listing. Roughly 150 mostly-NULL columns would be
-- the alternative, and every new field would be a migration.
--
-- Deliberate consequence: this adds NO new tables, so it introduces no new RLS
-- surface. The `listings` and `services` policies already in force govern these
-- columns unchanged.
--
-- Shape: {"version": <int>, "values": {<field id>: <value>, ...}}
-- The version is written by src/domain/listingSchema/registry.js (SCHEMA_VERSION)
-- so a document written under an older shape stays readable and can be migrated
-- deliberately rather than silently reinterpreted.
--
-- Field-level validation lives in the registry, which is the single source of
-- truth for labels, units, options and ranges. The constraint here enforces the
-- envelope only -- that is what the database can check without duplicating the
-- registry and drifting from it.

alter table public.listings
  add column if not exists attributes jsonb not null default '{"version": 1, "values": {}}'::jsonb;

alter table public.services
  add column if not exists attributes jsonb not null default '{"version": 1, "values": {}}'::jsonb;

-- NOTE: every clause is coalesced to false on purpose. When a key is absent
-- `p_value -> 'key'` is SQL NULL, `jsonb_typeof(NULL)` is NULL, and the
-- comparison yields NULL -- and a CHECK constraint PASSES on NULL, because
-- only FALSE rejects a row. Without the coalesce, `{"version":1}` (no values)
-- and `{"values":{}}` (no version) are both accepted. Both were, until this
-- was corrected.
create or replace function public.is_valid_attribute_document(p_value jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select coalesce(jsonb_typeof(p_value) = 'object', false)
     and coalesce(p_value ? 'version', false)
     and coalesce(p_value ? 'values', false)
     and coalesce(jsonb_typeof(p_value -> 'version') = 'number', false)
     and coalesce((p_value ->> 'version')::numeric >= 1, false)
     and coalesce(jsonb_typeof(p_value -> 'values') = 'object', false);
$function$;

alter table public.listings
  drop constraint if exists listings_attributes_shape;
alter table public.listings
  add constraint listings_attributes_shape
  check (public.is_valid_attribute_document(attributes));

alter table public.services
  drop constraint if exists services_attributes_shape;
alter table public.services
  add constraint services_attributes_shape
  check (public.is_valid_attribute_document(attributes));

-- `listings` exposes an explicit column allowlist to anon rather than a
-- table-level grant (see 0109), so a new column is invisible until granted.
-- Category attributes are public listing content, unlike the contact columns.
grant select (attributes) on public.listings to anon, authenticated;
grant select (attributes) on public.services to anon, authenticated;

-- Containment index for schema-driven filters (Part III §11). jsonb_path_ops
-- is smaller and faster than the default operator class for the `@>` queries
-- that facet filtering generates.
create index if not exists idx_listings_attributes_values
  on public.listings using gin ((attributes -> 'values') jsonb_path_ops);

create index if not exists idx_services_attributes_values
  on public.services using gin ((attributes -> 'values') jsonb_path_ops);
