import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  picker,
  taxonomyRepository,
  taxonomyService,
  adminPage,
  adminRepository,
  adminContracts,
  createListing,
  locationStep,
  createService,
  servicesService,
  serviceContracts,
  foundationMigration,
  metadataMigration,
  adminMigration,
  hierarchyMigration,
  privilegeMigration,
  privateAdminMigration,
  serviceTaxonomyMigration,
] = await Promise.all([
  read('src/components/create-listing/Step1Category.jsx'),
  read('src/repositories/taxonomyRepository.js'),
  read('src/services/taxonomyService.js'),
  read('src/pages/admin/AdminCategories.jsx'),
  read('src/repositories/taxonomyAdminRepository.js'),
  read('src/services/taxonomyAdminContracts.js'),
  read('src/pages/CreateListing.jsx'),
  read('src/components/create-listing/ListingLocationStep.jsx'),
  read('src/pages/CreateService.jsx'),
  read('src/services/servicesService.js'),
  read('src/services/serviceContracts.js'),
  read('supabase/migrations/20260808080000_canonical_taxonomy_foundation.sql'),
  read('supabase/migrations/20260808080500_taxonomy_metadata_integrity.sql'),
  read('supabase/migrations/20260808080700_taxonomy_admin_v2.sql'),
  read('supabase/migrations/20260808080800_taxonomy_hierarchy_integrity.sql'),
  read('supabase/migrations/20260808080900_taxonomy_function_privilege_boundary.sql'),
  read('supabase/migrations/20260808081000_private_taxonomy_admin_implementations.sql'),
  read('supabase/migrations/20260808081100_service_specialization_taxonomy.sql'),
]);

test('listing category selection consumes the canonical database taxonomy, not vertical arrays', () => {
  assert.match(picker, /getCategoryTaxonomy\(null, marketCountry\)/);
  assert.match(picker, /groupPostableNodes\(taxonomy, selected\.key\)/);
  assert.match(picker, /queryKey: \['public-category-taxonomy', marketCountry\]/);
  assert.doesNotMatch(picker, /PROPERTY_CATEGORIES|CAR_CATEGORIES|MACHINERY_CATEGORIES|SERVICE_CATEGORIES/);
  assert.match(picker, /No fallback list is used/);
});

test('taxonomy repository has one market-aware public read and resolution boundary', () => {
  assert.match(taxonomyRepository, /rpc\('public_category_taxonomy_v2'/);
  assert.match(taxonomyRepository, /p_marketplace_kind: marketplaceKind/);
  assert.match(taxonomyRepository, /p_country_code: countryCode/);
  assert.match(taxonomyRepository, /rpc\('resolve_category_taxonomy'/);
  assert.match(taxonomyService, /marketAvailability/);
  assert.match(taxonomyService, /schemaBinding/);
  assert.match(taxonomyService, /pathLabels/);
  assert.match(taxonomyService, /node\.isPostable && node\.nodeType === 'category' && !node\.supersededBy/);
});

test('listing draft and location selection keep taxonomy market scope explicit', () => {
  assert.match(createListing, /country_code: LAUNCH_COUNTRY_CODE/);
  assert.match(createListing, /getActiveLocations\('city', null, formData\.country_code \|\| LAUNCH_COUNTRY_CODE\)/);
  assert.match(locationStep, /update\('country_code', String\(selected\.country_code\)\.toUpperCase\(\)\)/);
  assert.match(locationStep, /queryKey: \['locations', 'city', marketCountry\]/);
});

test('service posting consumes canonical taxonomy and location registries without stale V1 lists', () => {
  assert.match(createService, /getCategoryTaxonomy\("service", marketCountry\)/);
  assert.match(createService, /getActiveLocations\("city", null, marketCountry\)/);
  assert.match(createService, /specializationGroups/);
  assert.match(createService, /validSpecializationSlugs/);
  assert.doesNotMatch(createService, /V1_SERVICE_CATEGORIES|getServiceCategory|ZIMBABWE_LOCATIONS/);
  assert.match(createService, /No stale fallback list is used/);
});

test('service contracts receive taxonomy capability sets instead of defining service vocabulary', () => {
  assert.doesNotMatch(serviceContracts, /V1_CATEGORIES|property_developer.*mechanic.*construction.*geological/);
  assert.match(serviceContracts, /requireAllowedSet\(taxonomy\.allowedCategories/);
  assert.match(serviceContracts, /requireAllowedSet\(allowedSubcategories/);
  assert.match(serviceContracts, /Service category is not active in the current taxonomy/);
  assert.match(serviceContracts, /Service type is not active in the current taxonomy/);
  assert.match(servicesService, /getCategoryTaxonomy\('service', countryCode\)/);
  assert.match(servicesService, /serviceDomainNodes\(taxonomy\)/);
  assert.match(servicesService, /serviceSpecializationNodes\(taxonomy, domain\)/);
  assert.match(servicesService, /schemaBinding\?\.defaults\?\.service_specialization/);
});

test('database taxonomy separates tree structure from postability and lifecycle', () => {
  for (const token of [
    'canonical_slug',
    'node_type',
    'is_postable',
    'aliases',
    'synonyms',
    'superseded_by',
    'valid_from',
    'valid_to',
    'schema_binding',
    'taxonomy_version',
  ]) assert.match(foundationMigration, new RegExp(token));

  assert.match(foundationMigration, /c\.is_postable[\s\S]*c\.node_type = 'category'[\s\S]*c\.superseded_by is null/);
  assert.doesNotMatch(foundationMigration, /parent_id is not null[\s\S]*raise exception 'listing category/i);
  assert.match(foundationMigration, /with recursive tree/);
  assert.match(foundationMigration, /'land_regime', land_regimes\.regime/);
  assert.match(foundationMigration, /'offer_type', 'rent'/);
  assert.match(foundationMigration, /'applications', jsonb_build_array\(machinery_bindings\.application\)/);
});

test('taxonomy lifecycle is localized, market-aware and collision guarded', () => {
  assert.match(metadataMigration, /localized_labels jsonb/);
  assert.match(metadataMigration, /market_availability text\[\]/);
  assert.match(metadataMigration, /uq_categories_current_canonical_slug/);
  assert.match(metadataMigration, /public\.resolve_category_taxonomy\([\s\S]*p_country_code text default null/);
  assert.match(adminMigration, /uq_categories_marketplace_stable_slug/);
  assert.match(adminMigration, /taxonomy_terms_collide/);
  assert.match(adminMigration, /superseded_by is null/);
  assert.match(hierarchyMigration, /taxonomy child market scope cannot exceed its parent/);
  assert.match(hierarchyMigration, /facet nodes cannot contain taxonomy children/);
});

test('admin taxonomy UI and RPCs support arbitrary-depth lifecycle management', () => {
  assert.match(adminRepository, /admin_taxonomy_rows_v2/);
  assert.match(adminRepository, /admin_add_taxonomy_node_v2/);
  assert.match(adminRepository, /admin_update_taxonomy_node_v2/);
  assert.match(adminPage, /Add taxonomy node/);
  assert.match(adminPage, /parentOptions\.map/);
  assert.match(adminPage, /category\.depth/);
  assert.match(adminPage, /Superseded by/);
  assert.match(adminPage, /Market availability/);
  assert.match(adminPage, /Localized labels/);
  assert.match(adminPage, /Only active nodes explicitly marked postable/);
  assert.match(adminContracts, /NODE_TYPES = new Set\(\['group', 'category', 'facet'\]\)/);
  assert.match(adminContracts, /marketAvailability/);
  assert.match(adminContracts, /localizedLabels/);
});

test('taxonomy functions close PostgreSQL default PUBLIC execute privileges', () => {
  assert.match(privilegeMigration, /privilege\.grantee = 0/);
  assert.match(privilegeMigration, /public_execute_count <> 0/);
  assert.match(privilegeMigration, /grant execute on function public\.public_category_taxonomy_v2\(text, text\) to anon, authenticated/);
  assert.match(privilegeMigration, /grant execute on function public\.admin_taxonomy_rows_v2\(\) to authenticated/);
  assert.match(privilegeMigration, /revoke all on function public\.taxonomy_terms_collide[\s\S]*from public, anon, authenticated, service_role/);
});

test('privileged taxonomy administration follows the private implementation/public invoker pattern', () => {
  assert.match(privateAdminMigration, /alter function %s set schema private/);
  assert.match(privateAdminMigration, /security invoker/);
  assert.match(privateAdminMigration, /implementation\.prosecdef/);
  assert.match(privateAdminMigration, /wrapper\.proconfig = array\['search_path=""'\]::text\[\]/);
  assert.match(privateAdminMigration, /taxonomy admin private\/public boundary did not converge/);
});

test('service specialization taxonomy preserves stable slugs while adding coherent hierarchy', () => {
  assert.match(serviceTaxonomyMigration, /slug in \('property_developer', 'mechanic', 'construction', 'geological'\)/);
  assert.match(serviceTaxonomyMigration, /construction_design_professional/);
  assert.match(serviceTaxonomyMigration, /construction_trades/);
  assert.match(serviceTaxonomyMigration, /construction_infrastructure/);
  assert.match(serviceTaxonomyMigration, /construction_plant_services/);
  assert.match(serviceTaxonomyMigration, /'pre_purchase_inspection', 'Pre-Purchase Inspections'/);
  assert.match(serviceTaxonomyMigration, /'plumbing', 'Plumbing & Drainage'/);
  assert.match(serviceTaxonomyMigration, /'land_surveying', 'Land Surveying & Mapping'/);
  assert.doesNotMatch(serviceTaxonomyMigration, /\('legal'/);
});
