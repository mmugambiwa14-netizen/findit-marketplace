begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_column('public', 'categories', 'canonical_slug', 'taxonomy nodes have an evolvable canonical slug');
select extensions.has_column('public', 'categories', 'node_type', 'taxonomy nodes distinguish groups/categories/facets');
select extensions.has_column('public', 'categories', 'is_postable', 'postability is explicit');
select extensions.has_column('public', 'categories', 'aliases', 'taxonomy nodes retain aliases');
select extensions.has_column('public', 'categories', 'synonyms', 'taxonomy nodes retain search synonyms');
select extensions.has_column('public', 'categories', 'superseded_by', 'taxonomy nodes can point at replacements');
select extensions.has_column('public', 'categories', 'valid_from', 'taxonomy nodes have lifecycle start time');
select extensions.has_column('public', 'categories', 'valid_to', 'taxonomy nodes have lifecycle end time');
select extensions.has_column('public', 'categories', 'schema_binding', 'taxonomy nodes bind to the listing schema');
select extensions.has_column('public', 'categories', 'taxonomy_version', 'taxonomy nodes carry a definition version');

select extensions.is(
  (select count(*)::bigint from public.categories where parent_id is null and node_type = 'group' and not is_postable),
  4::bigint,
  'all four marketplace roots are non-postable group nodes'
);

select extensions.is(
  (select count(*)::bigint from public.categories where parent_id is null and is_postable),
  0::bigint,
  'tree roots cannot accidentally receive listings'
);

select extensions.ok(
  (select is_postable and node_type = 'category' from public.categories where marketplace_kind = 'property' and slug = 'house_sale'),
  'an existing legacy listing leaf remains explicitly postable'
);

select extensions.is(
  (select schema_binding ->> 'subtype' from public.categories where marketplace_kind = 'property' and slug = 'house_sale'),
  'residential',
  'legacy house-for-sale is mapped to the residential schema subtype'
);

select extensions.is(
  (select schema_binding #>> '{defaults,property_type}' from public.categories where marketplace_kind = 'property' and slug = 'house_sale'),
  'house',
  'legacy house-for-sale carries an independent asset type default'
);

select extensions.is(
  (select schema_binding #>> '{defaults,offer_type}' from public.categories where marketplace_kind = 'property' and slug = 'house_sale'),
  'sale',
  'legacy house-for-sale carries an independent transaction default'
);

select extensions.is(
  (select schema_binding #>> '{defaults,land_regime}' from public.categories where marketplace_kind = 'property' and slug = 'a2_farm'),
  'a2',
  'Zimbabwe-specific A2 meaning is preserved as a land-regime dimension'
);

select extensions.is(
  (select schema_binding #>> '{defaults,offer_type}' from public.categories where marketplace_kind = 'car' and slug = 'cars_rent'),
  'rent',
  'vehicle rent is represented as an offer dimension rather than a physical asset identity'
);

select extensions.is(
  (select schema_binding #>> '{defaults,applications,0}' from public.categories where marketplace_kind = 'machinery' and slug = 'mining'),
  'mining',
  'machinery industry/application meaning is preserved separately from equipment type'
);

select extensions.has_function(
  'public', 'public_category_taxonomy', array['text'],
  'public taxonomy has one recursive read contract'
);
select extensions.has_function(
  'public', 'resolve_category_taxonomy', array['text', 'text', 'text'],
  'stable/canonical/alias taxonomy resolution supports optional market scope'
);
select extensions.is(
  (
    select pronargdefaults::integer
    from pg_proc
    where oid = 'public.resolve_category_taxonomy(text,text,text)'::regprocedure
  ),
  1,
  'the market-scoped resolver retains one optional country argument'
);
select extensions.is(
  to_regprocedure('public.resolve_category_taxonomy(text,text)'),
  null::regprocedure,
  'no redundant two-argument overload can make resolver calls ambiguous'
);
select extensions.has_function(
  'public', 'admin_taxonomy_rows', array[]::text[],
  'admin taxonomy read model supports the canonical registry'
);
select extensions.has_function(
  'public', 'admin_add_taxonomy_node',
  array['uuid','text','text','text','text','boolean','integer','jsonb','text[]','text[]','text'],
  'admin can create arbitrary-depth taxonomy nodes through a guarded contract'
);
select extensions.has_function(
  'public', 'admin_update_taxonomy_node',
  array['uuid','text','text','integer','boolean','boolean','text[]','text[]','uuid','timestamp with time zone','jsonb','text'],
  'admin can evolve taxonomy lifecycle metadata through a guarded contract'
);
select extensions.has_trigger(
  'public', 'listings', 'trg_listings_taxonomy_category',
  'listing writes enforce explicit taxonomy postability at the database boundary'
);

-- Prove arbitrary hierarchy depth without altering durable taxonomy state.
with property_root as (
  select id from public.categories where parent_id is null and marketplace_kind = 'property'
), inserted_group as (
  insert into public.categories (
    slug, canonical_slug, parent_id, marketplace_kind, display_label,
    node_type, is_postable, sort_order, schema_binding, valid_from
  )
  select
    'test_residential_group', 'test_residential_group', id, 'property',
    'Test Residential Group', 'group', false, 9990,
    '{"schema":"property"}'::jsonb, now()
  from property_root
  returning id
)
insert into public.categories (
  slug, canonical_slug, parent_id, marketplace_kind, display_label,
  node_type, is_postable, sort_order, schema_binding, valid_from
)
select
  'test_detached_house', 'test_detached_house', id, 'property',
  'Test Detached House', 'category', true, 1,
  '{"schema":"property","subtype":"residential","defaults":{"property_type":"house"}}'::jsonb,
  now()
from inserted_group;

select extensions.is(
  (
    select depth::integer
    from public.public_category_taxonomy('property')
    where stable_slug = 'test_detached_house'
  ),
  2,
  'recursive taxonomy reads support nodes deeper than root -> leaf'
);

select extensions.is(
  (
    select path_slugs
    from public.public_category_taxonomy('property')
    where stable_slug = 'test_detached_house'
  ),
  array['property','test_residential_group','test_detached_house']::text[],
  'recursive taxonomy reads return a stable navigation path'
);

-- Stable identity and current navigation identity can coexist during rename.
update public.categories
set canonical_slug = 'house',
    aliases = array['home_for_sale']::text[]
where marketplace_kind = 'property' and slug = 'house_sale';

select extensions.is(
  (select stable_slug from public.resolve_category_taxonomy('property', 'house_sale')),
  'house_sale',
  'old stable slug continues to resolve after a canonical rename'
);
select extensions.is(
  (select stable_slug from public.resolve_category_taxonomy('property', 'house')),
  'house_sale',
  'new canonical slug resolves to the same stable node'
);
select extensions.is(
  (select stable_slug from public.resolve_category_taxonomy('property', 'home_for_sale')),
  'house_sale',
  'explicit aliases resolve to the canonical taxonomy node'
);

set local role anon;
select extensions.ok(
  (select count(*) > 0 from public.public_category_taxonomy('property')),
  'anonymous marketplace clients can read the active canonical taxonomy'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.admin_taxonomy_rows()', 'EXECUTE'),
  'anonymous clients cannot execute taxonomy administration'
);
reset role;

set local role authenticated;
select extensions.throws_ok(
  $$insert into public.categories (
      slug, canonical_slug, parent_id, marketplace_kind, display_label,
      node_type, is_postable, schema_binding, valid_from
    )
    select 'client_injected', 'client_injected', id, 'property', 'Client Injected',
           'category', true, '{"schema":"property"}'::jsonb, now()
    from public.categories where parent_id is null and marketplace_kind = 'property'$$,
  '42501',
  null,
  'authenticated clients cannot bypass taxonomy admin RPCs with direct writes'
);
reset role;

select extensions.matches(
  pg_get_functiondef('public.enforce_listing_taxonomy_category()'::regprocedure),
  'is_postable[[:space:]]+and[[:space:]]+c\.node_type = ''category''[[:space:]]+and[[:space:]]+c\.superseded_by is null',
  'listing enforcement depends on explicit postability and lifecycle state, not parent depth'
);

select extensions.finish();
rollback;
