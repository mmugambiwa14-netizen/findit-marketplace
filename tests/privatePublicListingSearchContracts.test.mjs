import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, repository, scaleContracts] = await Promise.all([
  read('supabase/migrations/0097_private_public_listing_search_implementation.sql'),
  read('supabase/rollback/0097_private_public_listing_search_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/publicListingsRepository.js'),
  read('tests/releaseScaleCompletion.test.mjs'),
]);

test('public listing search moves behind a private stable implementation without reducing its result', () => {
  assert.match(migration, /alter function public\.public_listing_search_page/);
  assert.match(migration, /set schema private/);
  assert.match(migration, /create function public\.public_listing_search_page/);
  assert.match(migration, /language sql/);
  assert.match(migration, /stable/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /pronargdefaults <> 14/);
  assert.match(migration, /2fa173e978e3d5142ef72c6266e9dc20/);
  assert.match(migration, /fa68a2b80d7a4dd1844ef87566d01e12/);
  assert.match(migration, /stored public listing search callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a public listing search function/);
  assert.match(rollback, /set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('search wrapper preserves all fourteen defaults and thirty-one output columns', () => {
  assert.match(migration, /p_query text default ''/);
  assert.match(migration, /p_max_price numeric default 500000/);
  assert.match(migration, /p_sort text default 'newest'/);
  assert.match(migration, /p_limit integer default 24/);
  const resultBlock = migration.match(/returns table \([\s\S]*?\)\s*language sql/i)?.[0] ?? '';
  for (const field of [
    'id uuid', 'seller_id uuid', 'contact_phone text', 'title text', 'price numeric',
    'photos jsonb', 'latitude numeric', 'status text', 'views integer',
    'created_at timestamptz', 'location jsonb', 'car_details jsonb',
    'property_details jsonb', 'machinery_details jsonb', 'cursor_value text',
  ]) {
    assert.match(resultBlock, new RegExp(field.replace(/ /g, '\\s+')));
  }
  assert.equal((resultBlock.match(/^\s{4}[a-z_]+\s+(?:uuid|text|numeric|boolean|jsonb|integer|timestamptz),?$/gm) ?? []).length, 31);
});

test('active repository keeps the exact keyset RPC argument contract', () => {
  assert.match(repository, /supabase\.rpc\('public_listing_search_page'/);
  for (const argument of [
    'p_kind: request.kind',
    'p_query: request.query',
    'p_category: request.category',
    'p_location_id: request.locationId',
    'p_min_price: request.minPrice',
    'p_max_price: request.maxPrice',
    'p_min_bedrooms: request.minBedrooms',
    'p_brand: request.brand',
    'p_condition: request.condition',
    'p_fuel_type: request.fuelType',
    'p_transmission: request.transmission',
    'p_sort: request.sort',
    'p_cursor_value: request.cursor?.value ?? null',
    'p_cursor_id: request.cursor?.id ?? null',
    'p_limit: request.pageSize',
  ]) {
    assert.match(repository, new RegExp(argument.replace(/[?.]/g, '\\$&')));
  }
});

test('established scale contracts retain keyset ordering and limit-plus-one behavior', () => {
  assert.match(scaleContracts, /active public search uses bounded keyset pages/);
  assert.match(scaleContracts, /cursor_time, p_cursor_id/);
  assert.match(scaleContracts, /limit p_limit/);
  assert.match(scaleContracts, /public search executable contracts normalize paired sort cursors/);
  assert.match(scaleContracts, /price_desc/);
  assert.match(scaleContracts, /not-a-date/);
});

test('migration gates run the search boundary matrix and SQL tip advances to 0097', () => {
  assert.match(workflow, /v1_private_public_listing_search_implementation\.sql/);
  assert.match(sqlBoundary, /0097_private_public_listing_search_implementation\.sql/);
  assert.match(sqlBoundary, /0096_private_recommendation_event_implementation\.sql/);
});
