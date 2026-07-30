import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repair = await readFile(
  new URL('../supabase/maintenance/reconcile_staging_migration_history_0090.sql', import.meta.url),
  'utf8',
);

test('0090 staging reconciliation verifies exact seller-profile migration identity', () => {
  assert.match(repair, /where version = '0090'/i);
  assert.match(repair, /seller_profile_identifier_privacy/);
  assert.match(repair, /c90a4e5942969979fafe8ef7b02e812b/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 8212/i);
  assert.match(repair, /set version = '0090'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0090 staging reconciliation is ledger-only, fail-closed and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical migration version 0090 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0090/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
});
