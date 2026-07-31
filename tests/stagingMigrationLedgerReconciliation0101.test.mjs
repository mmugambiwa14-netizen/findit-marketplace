import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repair = await readFile(new URL('../supabase/maintenance/reconcile_staging_migration_history_0101.sql', import.meta.url), 'utf8');

test('0101 staging reconciliation is exact, guarded and metadata-only', () => {
  assert.match(repair, /version = '0101'/);
  assert.match(repair, /private_authenticated_rpc_implementations/);
  assert.match(repair, /20260731021100/);
  assert.match(repair, /498fd459be12f8a1c6c0174d25b09864/);
  assert.match(repair, /10105/);
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.doesNotMatch(repair, /delete from|truncate|drop table|alter table public\./i);
});
