import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [legacyMigration, legacyRollback, v2Migration, v2Rollback, workflow, databaseCertification, sqlBoundary, repository, scaleContracts] = await Promise.all([
  read('supabase/migrations/0097_private_public_listing_search_implementation.sql'),
  read('supabase/rollback/0097_private_public_listing_search_implementation.rollback.sql'),
  read('supabase/migrations/20260808020000_currency_safe_public_listing_search_v2.sql'),
  read('supabase/rollback/20260808020000_currency_safe_public_listing_search_v2.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/run-migration-database-certification.sh'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/publicListingsRepository.js'),
  read('tests/releaseScaleCompletion.test.mjs'),
]);

test('legacy public listing search remains an exact private implementation for rollback compatibility', () => {
  assert.match(legacyMigration, /alter function public\.public_listing_search_page/);
  assert.match(legacyMigration, /set schema private/);
  assert.match(legacyMigration, /create function public\.public_listing_search_page/);
  assert.match(legacyMigration, /language sql/);
  assert.match(legacyMigration, /stable/);
  assert.match(legacyMigration, /security invoker/);
  assert.match(legacyMigration, /pronargdefaults <> 14/);
  assert.match(legacyMigration, /2fa173e978e3d5142ef72c6266e9dc20/);
  assert.match(legacyMigration, /fa68a2b80d7a4dd1844ef87566d01e12/);
  assert.match(legacyMigration, /stored public listing search callers exist/);
  assert.match(legacyMigration, /left a PUBLIC execute grant on a public listing search function/);
  assert.match(legacyRollback, /set schema public/);
  assert.doesNotMatch(legacyMigration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(legacyRollback, /drop table|truncate|delete from/i);
});

test('legacy search preserves its fourteen defaults and thirty-one output columns', () => {
  assert.match(legacyMigration, /p_query text default ''/);
  assert.match(legacyMigration, /p_max_price numeric default 500000/);
  assert.match(legacyMigration, /p_sort text default 'newest'/);
  assert.match(legacyMigration, /p_limit integer default 24/);
  const resultBlock = legacyMigration.match(/returns table \([\s\S]*?\)\s*language sql/i)?.[0] ?? '';
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

test('v2 search adds currency and privacy boundaries without losing keyset pagination', () => {
  assert.match(v2Migration, /create or replace function private\.public_listing_search_page_v2/);
  assert.match(v2Migration, /create or replace function public\.public_listing_search_page_v2/);
  assert.match(v2Migration, /p_country_code text default 'ZW'/);
  assert.match(v2Migration, /p_currency text default ''/);
  assert.match(v2Migration, /p_min_price numeric default null/);
  assert.match(v2Migration, /p_max_price numeric default null/);
  assert.match(v2Migration, /listing\.native_currency/);
  assert.match(v2Migration, /listing\.native_price/);
  assert.match(v2Migration, /listing\.public_latitude/);
  assert.match(v2Migration, /listing\.public_longitude/);
  assert.match(v2Migration, /listing\.content_suspended_at is null/);
  assert.match(v2Migration, /has_contact_phone boolean/);
  assert.doesNotMatch(v2Migration.match(/returns table \([\s\S]*?\)\s*language plpgsql/i)?.[0] ?? '', /\bcontact_phone text\b|\bcontact_whatsapp text\b|\bcontact_email text\b/);
  assert.match(v2Migration, /p_sort in \('price_asc', 'price_desc'\) and normalized_currency = ''/);
  assert.match(v2Migration, /limit p_limit \+ 1/);
  assert.match(v2Migration, /revoke execute on function public\.public_listing_search_page/);
  assert.match(v2Rollback, /grant execute on function public\.public_listing_search_page/);
  assert.match(v2Rollback, /drop function if exists public\.public_listing_search_page_v2/);
});

test('active repository uses the v2 keyset RPC argument contract', () => {
  assert.match(repository, /supabase\.rpc\('public_listing_search_page_v2'/);
  assert.doesNotMatch(repository, /supabase\.rpc\('public_listing_search_page'/);
  for (const argument of [
    'p_kind: request.kind',
    'p_country_code: request.countryCode',
    'p_currency: request.currency',
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

test('database certification runs both the legacy rollback boundary and v2 search suite', () => {
  assert.match(workflow, /v1_private_public_listing_search_implementation\.sql/);
  assert.match(databaseCertification, /v1_private_public_listing_search_implementation\.sql/);
  assert.match(databaseCertification, /v1_currency_safe_public_listing_search_v2\.sql/);
  assert.match(sqlBoundary, /0097_private_public_listing_search_implementation\.sql/);
});
