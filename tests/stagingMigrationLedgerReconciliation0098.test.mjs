import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0098.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0098-2026-07-31.md'),
]);

test('0098 repair verifies the exact notification migration identity', () => {
  assert.match(repair, /version='0098'/);
  assert.match(repair, /private_notification_read_implementations/);
  assert.match(repair, /75a707810d3c120b283a1d6688019d6d/);
  assert.match(repair, /length\(array_to_string\(statements,E'\\n'\)\)=8451/);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/);
});

test('0098 repair is ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/);
  assert.match(repair, /canonical_rows=1 and matching_rows=1 and source_version='0098'/);
  assert.match(repair, /Do not run against production/);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.app_alerts\b/i);
});

test('0098 evidence records canonical ledger, notification ownership and advisor clearance', () => {
  assert.match(evidence, /Generated version \| `20260730233613`/);
  assert.match(evidence, /Statement MD5 \| `75a707810d3c120b283a1d6688019d6d`/);
  assert.match(evidence, /Canonical rows \| 98/);
  assert.match(evidence, /Last version \| `0098`/);
  assert.match(evidence, /Private `SECURITY DEFINER` implementations \| 3/);
  assert.match(evidence, /Public `SECURITY INVOKER` wrappers \| 3/);
  assert.match(evidence, /Unread count transition `3 → 2 → 0` \| Passed/);
  assert.match(evidence, /Cross-user mark-read attempt \| Returned false and changed no row/);
  assert.match(evidence, /Suspended-account access \| Rejected with SQLSTATE `42501`/);
  assert.match(evidence, /Residual notifications after rollback \| 0/);
  assert.match(evidence, /no longer reports these authenticated-callable/);
  assert.match(evidence, /anonymous-callable definer category remains at zero/i);
  assert.match(evidence, /production[\s\S]{0,140}migration `0049`/i);
});
