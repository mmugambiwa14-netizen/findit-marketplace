begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000a101', 'taxonomy-admin@example.test', '{"full_name":"Taxonomy Admin"}', now(), now()),
  ('00000000-0000-4000-8000-00000000a102', 'taxonomy-user@example.test', '{"full_name":"Taxonomy User"}', now(), now());

update public.users set role = 'admin', super_admin = true
where id = '00000000-0000-4000-8000-00000000a101';

select extensions.has_function('public', 'admin_taxonomy_rows_v2', array[]::text[], 'canonical taxonomy has a full admin read model');
select extensions.has_function(
  'public', 'admin_add_taxonomy_node_v2',
  array['uuid','text','text','text','text','text','boolean','integer','jsonb','text[]','text[]','jsonb','text[]','text'],
  'canonical taxonomy has a full admin create contract'
);
select extensions.has_function(
  'public', 'admin_update_taxonomy_node_v2',
  array['uuid','text','text','text','integer','boolean','boolean','text[]','text[]','jsonb','text[]','uuid','timestamp with time zone','jsonb','text'],
  'canonical taxonomy has a full admin lifecycle contract'
);
select extensions.has_trigger('public', 'categories', 'trg_categories_hierarchy_integrity', 'taxonomy hierarchy integrity is enforced at the table boundary');

select extensions.ok(
  not has_function_privilege('anon', 'public.admin_taxonomy_rows_v2()', 'EXECUTE'),
  'anonymous clients cannot execute taxonomy administration'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a102', true);
set local role authenticated;
select extensions.throws_ok(
  $$select * from public.admin_taxonomy_rows_v2()$$,
  '42501', 'admin access required',
  'ordinary authenticated users cannot read the admin taxonomy registry'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a101', true);
set local role authenticated;

select extensions.lives_ok(
  $$select public.admin_add_taxonomy_node_v2(
      (select id from public.categories where parent_id is null and marketplace_kind = 'property'),
      'taxonomy_test_residential', 'residential', 'Residential',
      'Residential property grouping used by the taxonomy certification suite.',
      'group', false, 9000,
      '{"schema":"property"}'::jsonb,
      array['homes']::text[],
      array['residential property']::text[],
      '{"sn":"Dzimba"}'::jsonb,
      array['ZW']::text[],
      'Create taxonomy certification group'
    )$$,
  'admins can create an intermediate group under a marketplace root'
);

select extensions.lives_ok(
  $$select public.admin_add_taxonomy_node_v2(
      (select id from public.categories where slug = 'taxonomy_test_residential'),
      'taxonomy_test_detached_house', 'detached_house', 'Detached house',
      'A standalone residential house.',
      'category', true, 10,
      '{"schema":"property","subtype":"residential","defaults":{"property_type":"house"}}'::jsonb,
      array['standalone_house']::text[],
      array['detached home']::text[],
      '{"sn":"Imba yakazvimirira"}'::jsonb,
      array['ZW']::text[],
      'Create taxonomy certification leaf'
    )$$,
  'admins can create a postable leaf beneath an intermediate group'
);

select extensions.is(
  (select depth from public.admin_taxonomy_rows_v2() where stable_slug = 'taxonomy_test_detached_house'),
  2,
  'admin read model preserves arbitrary hierarchy depth'
);
select extensions.is(
  (select path_labels from public.admin_taxonomy_rows_v2() where stable_slug = 'taxonomy_test_detached_house'),
  array['Property','Residential','Detached house']::text[],
  'admin read model exposes the complete taxonomy path'
);
select extensions.is(
  (select localized_labels ->> 'sn' from public.admin_taxonomy_rows_v2() where stable_slug = 'taxonomy_test_detached_house'),
  'Imba yakazvimirira',
  'localized labels are operational admin metadata'
);
select extensions.is(
  (select market_availability from public.admin_taxonomy_rows_v2() where stable_slug = 'taxonomy_test_detached_house'),
  array['ZW']::text[],
  'market availability is operational admin metadata'
);

select extensions.throws_ok(
  $$select public.admin_add_taxonomy_node_v2(
      (select id from public.categories where slug = 'taxonomy_test_residential'),
      'taxonomy_test_bad_market', 'bad_market', 'Bad market child', null,
      'category', true, 20,
      '{"schema":"property"}'::jsonb,
      '{}'::text[], '{}'::text[], '{}'::jsonb, array['ZA']::text[],
      'Prove child market scope validation'
    )$$,
  '22023', 'child market availability must fit within its parent',
  'admin contracts reject a child market outside its parent scope'
);

select extensions.throws_ok(
  $$select public.admin_add_taxonomy_node_v2(
      (select id from public.categories where slug = 'taxonomy_test_residential'),
      'taxonomy_test_collision', 'collision', 'Collision test', null,
      'category', true, 30,
      '{"schema":"property"}'::jsonb,
      array['detached_house']::text[], '{}'::text[], '{}'::jsonb, array['ZW']::text[],
      'Prove alias collision validation'
    )$$,
  '23505', 'taxonomy slug or alias already exists in this marketplace',
  'aliases cannot collide with another current canonical slug'
);

select extensions.lives_ok(
  $$select public.admin_add_taxonomy_node_v2(
      (select id from public.categories where slug = 'taxonomy_test_residential'),
      'taxonomy_test_house_v2', 'house_v2', 'House',
      'Replacement house category for lifecycle certification.',
      'category', true, 40,
      '{"schema":"property","subtype":"residential","defaults":{"property_type":"house"}}'::jsonb,
      '{}'::text[], array['home']::text[], '{}'::jsonb, array['ZW']::text[],
      'Create taxonomy replacement node'
    )$$,
  'admins can create a replacement taxonomy node'
);

select extensions.lives_ok(
  $$select public.admin_update_taxonomy_node_v2(
      (select id from public.categories where slug = 'taxonomy_test_detached_house'),
      'detached_house', 'Detached house', 'A standalone residential house.',
      10, true, true,
      array['standalone_house']::text[], array['detached home']::text[],
      '{"sn":"Imba yakazvimirira"}'::jsonb, array['ZW']::text[],
      (select id from public.categories where slug = 'taxonomy_test_house_v2'),
      null,
      '{"schema":"property","subtype":"residential","defaults":{"property_type":"house"}}'::jsonb,
      'Supersede the old certification leaf'
    )$$,
  'admins can supersede a taxonomy node without rewriting its stable identity'
);

select extensions.ok(
  not (select is_postable from public.categories where slug = 'taxonomy_test_detached_house'),
  'superseded taxonomy nodes automatically stop accepting new listings'
);
select extensions.is(
  (select count(*)::bigint from public.public_category_taxonomy_v2('property', 'ZW') where stable_slug = 'taxonomy_test_detached_house'),
  0::bigint,
  'superseded nodes disappear from the current browse/post taxonomy'
);
select extensions.is(
  (select superseded_by from public.resolve_category_taxonomy('property', 'detached_house', 'ZW')),
  (select id from public.categories where slug = 'taxonomy_test_house_v2'),
  'old canonical links still resolve with an explicit replacement target'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

-- Table-level integrity also protects privileged/import paths that do not use
-- admin RPCs.
select extensions.throws_ok(
  $$insert into public.categories (
      slug, canonical_slug, parent_id, marketplace_kind, display_label,
      node_type, is_postable, sort_order, market_availability, schema_binding, valid_from
    ) values (
      'taxonomy_direct_bad_scope', 'direct_bad_scope',
      (select id from public.categories where slug = 'taxonomy_test_residential'),
      'property', 'Direct bad scope', 'category', true, 50,
      '{}'::text[], '{"schema":"property"}'::jsonb, now()
    )$$,
  '22023', 'taxonomy child market scope cannot exceed its parent',
  'table boundary prevents a globally scoped child beneath a market-limited parent'
);

select extensions.finish();
rollback;
