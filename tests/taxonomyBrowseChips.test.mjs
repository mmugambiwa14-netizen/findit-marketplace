import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [component, metadataMigration] = await Promise.all([
  read('src/components/search/CategoryFilterChips.jsx'),
  read('supabase/migrations/20260808081200_taxonomy_browse_chip_metadata.sql'),
]);

test('buyer category chips are selected from taxonomy metadata rather than React category arrays', () => {
  assert.match(component, /getCategoryTaxonomy\(type, normalizedCountry\)/);
  assert.match(component, /schemaBinding\?\.ui\?\.browse_chip_order/);
  assert.match(component, /node\.stableSlug/);
  assert.match(component, /node\.label/);
  assert.doesNotMatch(component, /PROPERTY_CHIPS|CAR_CHIPS|MACHINERY_CHIPS|SERVICE_CHIPS|V1_SERVICE_CATEGORIES/);
  assert.doesNotMatch(component, /house_sale|cars_sale|heavy_vehicles|property_developer/);
});

test('featured browse selection is canonical taxonomy metadata and stays separate from postability', () => {
  assert.match(metadataMigration, /schema_binding[\s\S]*browse_chip_order/);
  assert.match(metadataMigration, /\('property', 'house_sale', 10\)/);
  assert.match(metadataMigration, /\('car', 'cars_sale', 10\)/);
  assert.match(metadataMigration, /\('machinery', 'heavy_vehicles', 10\)/);
  assert.match(metadataMigration, /\('service', 'property_developer', 10\)/);
  assert.match(metadataMigration, /marketplace_kind <> 'service'[\s\S]*node_type <> 'category' or not is_postable/);
});
