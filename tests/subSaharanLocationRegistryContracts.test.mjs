import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SUB_SAHARAN_COUNTRIES,
  SUB_SAHARAN_COUNTRY_CODES,
} from '../scripts/location-registry/sub-saharan-countries.mjs';

const [
  migration,
  rollback,
  canonicalMigration,
  resolverMigration,
  boundaryIndexMigration,
  syncScript,
  reconcileScript,
  repository,
  service,
  selector,
  permissionDialog,
  placeSearch,
  featureFlags,
  stagingPolicy,
] = await Promise.all([
  readFile(new URL('../supabase/migrations/0102_sub_saharan_location_registry.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0102_sub_saharan_location_registry.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0103_canonical_sub_saharan_admin1_hierarchy.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0105_consented_location_resolver_least_privilege.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/0106_active_country_boundary_spatial_index.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/sync-sub-saharan-location-registry.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/reconcile-sub-saharan-admin1.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/repositories/locationsRepository.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/locationsService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/location/LocationSelector.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/location/LocationPermissionDialog.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/location/PlaceSearchCombobox.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/featureFlags.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/stagingCapabilityPolicy.js', import.meta.url), 'utf8'),
]);

const EXPECTED_CODES = [
  'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD',
  'CI', 'DJ', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
  'LS', 'LR', 'MG', 'MW', 'ML', 'MR', 'MU', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'TZ', 'TG', 'UG', 'ZM', 'ZW',
];

test('country manifest is the 48-sovereign-state UN M49 Sub-Saharan scope', () => {
  assert.equal(SUB_SAHARAN_COUNTRIES.length, 48);
  assert.deepEqual(new Set(SUB_SAHARAN_COUNTRY_CODES), new Set(EXPECTED_CODES));
  assert.equal(SUB_SAHARAN_COUNTRY_CODES.includes('SD'), false);
  assert.equal(new Set(SUB_SAHARAN_COUNTRIES.map(({ iso3 }) => iso3)).size, 48);
  assert.equal(new Set(SUB_SAHARAN_COUNTRIES.map(({ geonameId }) => geonameId)).size, 48);
});

test('migration adds indexed search, boundary hierarchy, and non-persisting resolution APIs', () => {
  assert.match(migration, /idx_locations_active_parent_place_search/);
  assert.match(migration, /idx_locations_active_place_coordinates/);
  assert.match(migration, /idx_locations_active_admin_boundaries/);
  assert.match(migration, /create or replace function public\.search_marketplace_places/);
  assert.match(migration, /create or replace function public\.get_marketplace_location_hierarchy/);
  assert.match(migration, /create or replace function public\.resolve_marketplace_location/);
  assert.match(migration, /security invoker/g);
  assert.match(migration, /st_covers\(province\.boundary_geometry, input\.geometry_point\)/i);
  assert.doesNotMatch(migration, /insert into public\.locations[\s\S]{0,300}Harare[\s\S]{0,300}Bulawayo/i);
  assert.match(rollback, /drop function if exists public\.resolve_marketplace_location/);
  assert.doesNotMatch(rollback, /delete\s+from|truncate|drop\s+table/i);
});

test('registry is provider-synchronized rather than hard-coded into the browser bundle', () => {
  assert.match(syncScript, /download\.geonames\.org/);
  assert.match(syncScript, /geoboundaries\.org\/api\/current\/gbOpen/);
  assert.match(syncScript, /EXCLUDED_FEATURE_CODES = new Set\(\['PPLH', 'PPLQ', 'PPLW', 'PPLCH'\]\)/);
  assert.match(syncScript, /spatial_fallback_count/);
  assert.match(syncScript, /source_checksum/);
  assert.match(syncScript, /--expected-project-ref/);
  assert.match(syncScript, /CC BY 4\.0/g);
  assert.match(reconcileScript, /admin1CodesASCII\.txt/);
  assert.match(reconcileScript, /ADM0-simplified\.geojson/);
  assert.match(reconcileScript, /findit_unresolved_places/);
  assert.match(reconcileScript, /CANONICAL_ADMIN1_NAME_OVERRIDES/);
  assert.match(reconcileScript, /country_boundary_provider/);
  assert.match(reconcileScript, /--expected-project-ref/);
});

test('canonical hierarchy and consented resolver are current, bounded, and least privilege', () => {
  assert.match(canonicalMigration, /location_registry_admin1_syncs/);
  assert.match(canonicalMigration, /idx_locations_geonames_place_admin1_code/);
  assert.match(resolverMigration, /security invoker/);
  assert.match(resolverMigration, /containing_country as materialized/);
  assert.match(resolverMigration, /candidate\.country_code = country\.country_code/);
  assert.match(resolverMigration, /select\s+candidate\.id,\s+candidate\.name,\s+candidate\.type,\s+candidate\.parent_id,\s+candidate\.coordinate_point/i);
  assert.doesNotMatch(resolverMigration, /select candidate\.\*/i);
  assert.match(boundaryIndexMigration, /idx_locations_active_country_boundaries/);
  assert.match(boundaryIndexMigration, /using gist\(boundary_geometry\)/i);
});

test('manual browsing is country-independent and populated places are searched by ADM1 parent', () => {
  assert.match(repository, /type === 'country' \? null : LAUNCH_COUNTRY_CODE/);
  assert.match(repository, /search_marketplace_places/);
  assert.match(service, /searchMarketplacePlaces\(parentId, searchTerm/);
  assert.match(selector, /getActiveLocations\('province', country, selectedCountryCode\)/);
  assert.match(selector, /PlaceSearchCombobox/);
  assert.match(selector, /Country selection always stays unlocked/);
  assert.doesNotMatch(selector, /onSelectLocation\(null\)/);
  assert.match(placeSearch, /role="combobox"/);
  assert.match(placeSearch, /role="listbox"/);
  assert.match(placeSearch, /role="option"/);
});

test('browser geolocation follows explicit app consent and staging policy', () => {
  assert.match(permissionDialog, /Use your location once\?/);
  assert.match(permissionDialog, /coordinates[\s\S]*not added to your profile or saved in this browser/i);
  assert.match(permissionDialog, /browse Botswana while you are in Zambia/i);
  assert.match(permissionDialog, /Allow once/);
  assert.match(selector, /setPermissionOpen\(true\)/);
  assert.match(selector, /resolveCurrentMarketplaceLocation\(\{ consentGranted: true \}\)/);
  assert.match(featureFlags, /currentLocation: stagingCertifiedFlag\('VITE_FEATURE_CURRENT_LOCATION'\)/);
  assert.match(stagingPolicy, /export function resolveStagingCertifiedFlag/);
});
