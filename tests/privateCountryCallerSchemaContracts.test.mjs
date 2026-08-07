import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const databaseTest = readFileSync(
  new URL('../supabase/tests/v1_private_country_helper_implementations.sql', import.meta.url),
  'utf8',
);
const searchBoundary = readFileSync(
  new URL('../supabase/migrations/0097_private_public_listing_search_implementation.sql', import.meta.url),
  'utf8',
);
const authenticatedBoundary = readFileSync(
  new URL('../supabase/migrations/0101_private_authenticated_rpc_implementations.sql', import.meta.url),
  'utf8',
);

test('country-helper behavior test follows the current private caller implementations', () => {
  assert.match(searchBoundary, /alter function public\.public_listing_search_page[\s\S]*set schema private/i);
  assert.match(authenticatedBoundary, /alter function %s set schema private/i);
  assert.equal((databaseTest.match(/caller_schema\.nspname = 'private'/g) || []).length, 4);
  assert.doesNotMatch(databaseTest, /caller_schema\.nspname = 'public'/);
  assert.match(databaseTest, /private stored implementations retain public-compatible country helper calls/i);
});
