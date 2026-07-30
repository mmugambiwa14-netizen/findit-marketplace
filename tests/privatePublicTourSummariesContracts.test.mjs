import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary] = await Promise.all([
  read('supabase/migrations/0091_private_public_tour_summaries_implementation.sql'),
  read('supabase/rollback/0091_private_public_tour_summaries_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
]);

test('public Tour summaries move behind a private definer and public invoker wrapper', () => {
  assert.match(migration, /alter function public\.public_tour_summaries\(uuid\[\], uuid\[\]\) set schema private/);
  assert.match(migration, /create function public\.public_tour_summaries/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /from private\.public_tour_summaries\(p_listing_ids, p_service_ids\)/);
  assert.match(migration, /3e72ef0e86cc539ee9f87ba6173def30/);
  assert.match(migration, /too many Tour-summary callers exist|stored Tour-summary callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a Tour-summary function/);
  assert.match(rollback, /alter function private\.public_tour_summaries\(uuid\[\], uuid\[\]\) set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('Tour summary boundary preserves signature, result shape and role parity', () => {
  assert.match(migration, /p_listing_ids uuid\[\], p_service_ids uuid\[\]/);
  assert.match(migration, /tour_id uuid/);
  assert.match(migration, /duration_seconds numeric/);
  assert.match(migration, /published_at timestamptz/);
  assert.match(migration, /grant execute on function private\.public_tour_summaries\(uuid\[\], uuid\[\]\)[\s\S]{0,120}to anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.public_tour_summaries\(uuid\[\], uuid\[\]\)[\s\S]{0,120}to anon, authenticated, service_role/);
  assert.match(rollback, /did not restore the canonical public Tour-summary implementation/);
});

test('migration gates run the Tour summary matrix and SQL boundary is advanced to 0091', () => {
  assert.match(workflow, /v1_private_public_tour_summaries_implementation\.sql/);
  assert.match(sqlBoundary, /0091_private_public_tour_summaries_implementation\.sql/);
});
