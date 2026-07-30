import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0092.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0092-2026-07-30.md'),
]);

test('0092 staging reconciliation verifies the exact province hierarchy migration identity', () => {
  assert.match(repair, /where version = '0092'/i);
  assert.match(repair, /zimbabwe_province_hierarchy/);
  assert.match(repair, /d4abcc073bbd14b18cefa3ef33187d7b/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 3983/i);
  assert.match(repair, /set version = '0092'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0092 staging reconciliation is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical_rows = 1 and matching_rows = 1 and source_version = '0092'/i);
  assert.match(repair, /canonical migration version 0092 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0092/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\b(?:insert|update)\s+public\.locations\b/i);
});

test('0092 evidence records the canonical Zimbabwe hierarchy and no production change', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Generated version \| `20260730202651`/);
  assert.match(evidence, /Statement MD5 \| `d4abcc073bbd14b18cefa3ef33187d7b`/);
  assert.match(evidence, /Canonical migration rows \| 92/);
  assert.match(evidence, /Last version \| `0092`/);
  assert.match(evidence, /Remaining generated versions \| 0/);
  assert.match(evidence, /Active canonical provinces \| 10/);
  assert.match(evidence, /Active canonical towns with active province \| 58/);
  assert.match(evidence, /Correctly parented existing seed cities \| 10/);
  assert.match(evidence, /Same-type Zimbabwe location-name duplicates \| 0/);
  assert.match(evidence, /production[\s\S]{0,180}remains at migration `0049`/i);
});
