import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, repository, smoke, certification] = await Promise.all([
  read('supabase/migrations/20260808043000_public_listing_search_card_projection.sql'),
  read('supabase/rollback/20260808043000_public_listing_search_card_projection.rollback.sql'),
  read('src/repositories/publicListingsRepository.js'),
  read('scripts/phase7-search-scale-smoke-local.mjs'),
  read('scripts/run-migration-database-certification.sh'),
]);

function activeSearchRepositoryBlock() {
  const start = repository.indexOf('export async function findPublicListingsPage');
  const end = repository.indexOf('export async function findPublicListingTitleSuggestions', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return repository.slice(start, end);
}

test('active public Search calls the thin card RPC and retains abortable keysets', () => {
  const block = activeSearchRepositoryBlock();
  assert.match(block, /public_listing_search_card_page_v1/);
  assert.doesNotMatch(block, /public_listing_search_page_v2/);
  assert.match(block, /p_cursor_value: request\.cursor\?\.value \?\? null/);
  assert.match(block, /p_cursor_id: request\.cursor\?\.id \?\? null/);
  assert.match(block, /p_limit: request\.pageSize/);
  assert.match(block, /abortSignal\(signal\)/);
});

test('thin Search rows omit detail-only fields and project exactly one cover', () => {
  const privateFunction = migration.match(/create or replace function private\.public_listing_search_card_page_v1[\s\S]*?\n\$\$;/)?.[0] || '';
  const resultBlock = privateFunction.match(/returns table \([\s\S]*?\)\s*language plpgsql/i)?.[0] || '';
  assert.match(privateFunction, /jsonb_build_array\(listing\.photos -> 0\)/);
  assert.doesNotMatch(resultBlock, /description text/);
  assert.doesNotMatch(resultBlock, /deposit numeric/);
  assert.doesNotMatch(resultBlock, /agent_fee numeric/);
  assert.doesNotMatch(resultBlock, /additional_fees numeric/);
  assert.doesNotMatch(resultBlock, /created_via text/);
  assert.doesNotMatch(resultBlock, /updated_at timestamptz/);
  for (const required of ['title text', 'price numeric', 'currency text', 'variants jsonb', 'photos jsonb', 'latitude numeric', 'longitude numeric', 'views integer', 'cursor_value text']) {
    assert.match(resultBlock, new RegExp(required.replace(' ', '\\s+')));
  }
});

test('thin Search preserves the v2 market, privacy and deterministic keyset rules', () => {
  assert.match(migration, /listing\.status in \('available', 'under_offer'\)/);
  assert.match(migration, /listing\.content_suspended_at is null/);
  assert.match(migration, /listing\.native_currency/);
  assert.match(migration, /listing\.native_price/);
  assert.match(migration, /listing\.public_latitude/);
  assert.match(migration, /listing\.public_longitude/);
  assert.match(migration, /\(listing\.created_at, listing\.id\) < \(cursor_time, p_cursor_id\)/);
  assert.match(migration, /\(coalesce\(listing\.native_price, listing\.price\), listing\.id\) > \(cursor_number, p_cursor_id\)/);
  assert.match(migration, /\(listing\.views, listing\.id\) < \(cursor_views, p_cursor_id\)/);
  assert.match(migration, /limit p_limit \+ 1/);
});

test('v2 remains untouched as a compatibility and rollback path', () => {
  assert.doesNotMatch(migration, /drop function if exists public\.public_listing_search_page_v2/);
  assert.doesNotMatch(migration, /revoke execute on function public\.public_listing_search_page_v2/);
  assert.doesNotMatch(rollback, /(?:drop function if exists|revoke (?:all|execute) on function|alter function|create or replace function)\s+(?:public|private)\.public_listing_search_page_v2/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('scale smoke traverses the thin payload and clean database runs its pgTAP suite', () => {
  assert.match(smoke, /public_listing_search_card_page_v1/);
  assert.match(smoke, /Object\.hasOwn\(row, 'description'\), false/);
  assert.match(smoke, /row\.photos\.length <= 1/);
  assert.match(smoke, /keyset page \$\{pageNumber\} must not repeat/);
  assert.match(certification, /v1_public_listing_search_card_projection\.sql/);
});
