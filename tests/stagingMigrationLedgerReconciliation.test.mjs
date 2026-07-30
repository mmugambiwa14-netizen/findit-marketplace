import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0077_0082.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-2026-07-30.md'),
]);

const mappings = [
  ['0077', 'real_marketplace_view_counting', '7912fa31d66a3d0ee88c08c1bd040bb3', '1656'],
  ['0078', 'service_catalog_recommendation_alignment', '1b7e1cadd527e661c33f7af2e436746c', '4618'],
  ['0079', 'on_demand_recommendation_projection', 'e75c89ddee52cb538dc099259a9075db', '1899'],
  ['0080', 'listing_detail_related_services_context', '12a1ad7ab6d477a7f8b79986ab07ba5b', '1705'],
  ['0081', 'public_business_profile_view_security', '1e7fd9e2fe6f1c479ae91b163c3f0efa', '2393'],
  ['0082', 'pg_trgm_extension_schema_security', 'b717618066f5730b9f7887b2bdfbe0ed', '423'],
];

test('staging ledger repair verifies exact migration identity before metadata changes', () => {
  for (const [version, name, hash, length] of mappings) {
    assert.match(repair, new RegExp(`'${version}'`));
    assert.match(repair, new RegExp(name));
    assert.match(repair, new RegExp(hash));
    assert.match(repair, new RegExp(`\\b${length}\\b`));
  }
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /md5\(array_to_string\(statements, E'\\n'\)\)/i);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\)/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('staging ledger repair changes version metadata only and fails closed on drift', () => {
  assert.match(repair, /update supabase_migrations\.schema_migrations\s+set version = repair\.canonical_version/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(repair, /expected exactly one verified source row/i);
  assert.match(repair, /canonical migration version % is already occupied/i);
  assert.match(repair, /if canonical_rows = 1 and matching_rows = 1 and source_version = repair\.canonical_version then\s+continue;/i);
});

test('reconciliation evidence names staging and explicitly excludes production', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Production impact: none/);
  assert.match(evidence, /production project/i);
  assert.match(evidence, /remain(?:s)?(?: unchanged)? at\s+`0049`/i);
  assert.match(evidence, /migration metadata\s+reconciliation, not a production migration/i);
});
