begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
    from public.categories
    where marketplace_kind = 'service'
      and slug in ('property_developer', 'mechanic', 'construction', 'geological')
      and node_type = 'group'
      and not is_postable
      and is_active
      and superseded_by is null
  ),
  4::bigint,
  'the four active legacy service domains are canonical non-postable groups'
);

select extensions.is(
  (
    select count(*)::bigint
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug in ('property_developer', 'mechanic', 'construction', 'geological')
      and node_type = 'group'
      and not is_postable
  ),
  4::bigint,
  'all active V1 service domains are visible in the Zimbabwe browse taxonomy'
);

select extensions.is(
  (
    select count(*)::bigint
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug = 'legal'
       or 'legal' = any(path_slugs)
  ),
  0::bigint,
  'Legal is not reintroduced into the active V1 service taxonomy'
);

select extensions.ok(
  exists (
    select 1
    from public.categories
    where marketplace_kind = 'service'
      and slug = 'pre_purchase_inspection'
      and node_type = 'category'
      and is_postable
      and schema_binding #>> '{defaults,service_domain}' = 'mechanic'
      and schema_binding #>> '{defaults,service_specialization}' = 'pre_purchase_inspection'
  ),
  'mechanic pre-purchase inspection is a canonical postable specialization'
);

select extensions.ok(
  exists (
    select 1
    from public.categories
    where marketplace_kind = 'service'
      and slug = 'land_surveying'
      and node_type = 'category'
      and is_postable
      and schema_binding #>> '{defaults,service_domain}' = 'geological'
  ),
  'land surveying remains a canonical Geological specialization'
);

select extensions.is(
  (
    select path_slugs
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug = 'plumbing'
  ),
  array['service', 'construction', 'construction_trades', 'plumbing']::text[],
  'construction plumbing is organized beneath the Trades group without changing its stable slug'
);

select extensions.is(
  (
    select path_labels
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug = 'architectural_design'
  ),
  array['Services', 'Construction & Equipment', 'Design & Professional', 'Architectural Design & Drawings']::text[],
  'architecture is exposed through the coherent Design & Professional branch'
);

select extensions.is(
  (
    select path_labels
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug = 'solar_installation'
  ),
  array['Services', 'Construction & Equipment', 'Property Infrastructure', 'Solar & Backup Power Installation']::text[],
  'solar installation is exposed through Property Infrastructure'
);

select extensions.is(
  (
    select path_labels
    from public.public_category_taxonomy_v2('service', 'ZW')
    where stable_slug = 'plant_hire'
  ),
  array['Services', 'Construction & Equipment', 'Plant & Machinery Services', 'Plant & Equipment Hire']::text[],
  'plant hire is exposed through Plant & Machinery Services'
);

select extensions.ok(
  (
    select count(*)
    from public.public_category_taxonomy_v2('service', 'ZW')
    where node_type = 'category' and is_postable
  ) >= 46,
  'the canonical service tree preserves the existing V1 specialization depth rather than collapsing it'
);

select extensions.ok(
  'vehicle inspection' = any(
    (select synonyms from public.categories where marketplace_kind = 'service' and slug = 'pre_purchase_inspection')
  ),
  'service specializations carry searchable synonyms in canonical reference data'
);

select extensions.matches(
  pg_get_functiondef('public.enforce_listing_taxonomy_category()'::regprocedure),
  'is_postable[[:space:]]+and[[:space:]]+c\.node_type = ''category''',
  'listing postability remains explicit and independent of taxonomy depth'
);

select * from extensions.finish();
rollback;
