import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0095.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0095-2026-07-31.md'),
]);

test('0095 staging reconciliation verifies the exact support migration identity', () => {
  assert.match(repair, /where version = '0095'/i);
  assert.match(repair, /private_support_request_implementation/);
  assert.match(repair, /a228f7169d9191274b20b15241716abe/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 8325/i);
  assert.match(repair, /set version = '0095'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0095 reconciliation is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical_rows = 1 and matching_rows = 1 and source_version = '0095'/i);
  assert.match(repair, /canonical migration version 0095 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0095/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.support_requests\b/i);
});

test('0095 evidence records hosted privacy, rate limiting, canonical ledger state and no production change', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Generated version \| `20260730230156`/);
  assert.match(evidence, /Statement MD5 \| `a228f7169d9191274b20b15241716abe`/);
  assert.match(evidence, /Statement length \| 8325/);
  assert.match(evidence, /Canonical migration rows \| 95/);
  assert.match(evidence, /Last version \| `0095`/);
  assert.match(evidence, /Remaining generated versions \| 0/);
  assert.match(evidence, /Private volatile `SECURITY DEFINER` implementations \| 1/);
  assert.match(evidence, /Public volatile `SECURITY INVOKER` wrappers \| 1/);
  assert.match(evidence, /Omitted optional related reference \| Passed on both paths/);
  assert.match(evidence, /Guest raw inbox read \| Denied/);
  assert.match(evidence, /Fourth request within 15 minutes \| Rejected with SQLSTATE `P0001`/);
  assert.match(evidence, /Residual support rows after rollback \| 0/);
  assert.match(evidence, /no longer reports `public\.submit_support_request`/i);
  assert.match(evidence, /production[\s\S]{0,180}remains migration `0049`/i);
});
