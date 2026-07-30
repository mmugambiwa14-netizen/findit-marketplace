import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0097.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0097-2026-07-31.md'),
]);

test('0097 repair verifies the exact listing-search migration identity', () => {
  assert.match(repair, /version='0097'/);
  assert.match(repair, /private_public_listing_search_implementation/);
  assert.match(repair, /6f4a8444625267fd9d2eaf440eff233d/);
  assert.match(repair, /length\(array_to_string\(statements,E'\\n'\)\)=8908/);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/);
});

test('0097 repair is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/);
  assert.match(repair, /canonical_rows=1 and matching_rows=1 and source_version='0097'/);
  assert.match(repair, /canonical migration version 0097 is already occupied/);
  assert.match(repair, /Do not run against production/);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.listings\b/i);
});

test('0097 evidence records full keyset behavior, canonical ledger and anonymous-definer clearance', () => {
  assert.match(evidence, /Generated version \| `20260730232401`/);
  assert.match(evidence, /Statement MD5 \| `6f4a8444625267fd9d2eaf440eff233d`/);
  assert.match(evidence, /Canonical rows \| 97/);
  assert.match(evidence, /Last version \| `0097`/);
  assert.match(evidence, /Preserved default arguments \| 14/);
  assert.match(evidence, /Preserved output fields \| 31/);
  assert.match(evidence, /Newest keyset traversal \| Three pages, no duplicate or skipped visible row/);
  assert.match(evidence, /Draft exclusion \| Passed/);
  assert.match(evidence, /Content-suspension exclusion \| Passed/);
  assert.match(evidence, /Public\/private result parity \| Passed/);
  assert.match(evidence, /Malformed cursor \| Rejected with SQLSTATE `22023`/);
  assert.match(evidence, /Residual listings after rollback \| 0/);
  assert.match(evidence, /zero.*anon_security_definer_function_executable/is);
  assert.match(evidence, /production[\s\S]{0,140}migration `0049`/i);
});
