import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0093.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0093-2026-07-30.md'),
]);

test('0093 staging reconciliation verifies the exact marketplace-view migration identity', () => {
  assert.match(repair, /where version = '0093'/i);
  assert.match(repair, /private_marketplace_view_implementation/);
  assert.match(repair, /0034925ba82386a9d2147fd09fa72de4/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 7672/i);
  assert.match(repair, /set version = '0093'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0093 staging reconciliation is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical_rows = 1 and matching_rows = 1 and source_version = '0093'/i);
  assert.match(repair, /canonical migration version 0093 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0093/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.(?:listings|services)\b/i);
});

test('0093 evidence records hosted counter semantics and no production change', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Generated version \| `20260730204610`/);
  assert.match(evidence, /Statement MD5 \| `0034925ba82386a9d2147fd09fa72de4`/);
  assert.match(evidence, /Private volatile marketplace-view definers \| 1/);
  assert.match(evidence, /Public volatile invoker wrappers \| 1/);
  assert.match(evidence, /Anonymous available-listing view \| incremented 5 to 6/);
  assert.match(evidence, /Listing-owner self view \| remained 6/);
  assert.match(evidence, /Different authenticated service viewer \| incremented 8 to 9/);
  assert.match(evidence, /Residual fixture rows after rollback \| 0/);
  assert.match(evidence, /Canonical migration rows \| 93/);
  assert.match(evidence, /Last version \| `0093`/);
  assert.match(evidence, /Remaining generated versions \| 0/);
  assert.match(evidence, /production[\s\S]{0,180}remains at migration `0049`/i);
});
