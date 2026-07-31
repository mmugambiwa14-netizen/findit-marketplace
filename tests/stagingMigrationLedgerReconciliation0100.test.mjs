import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repair = await readFile(new URL('../supabase/maintenance/reconcile_staging_migration_history_0100.sql', import.meta.url), 'utf8');

test('0100 staging reconciliation is identity-guarded and metadata-only', () => {
  assert.match(repair, /version = '0100'/);
  assert.match(repair, /name = 'release_control_consistency'/);
  assert.match(repair, /20260731013402/);
  assert.match(repair, /a33c974cd9ebb77ef3789342a202538e/);
  assert.match(repair, /5042/);
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.doesNotMatch(repair, /delete from|truncate|drop table|alter table public\./i);
});
