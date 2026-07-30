import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0094.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0094-2026-07-31.md'),
]);

test('0094 staging reconciliation verifies the exact recommended-service event migration identity', () => {
  assert.match(repair, /where version = '0094'/i);
  assert.match(repair, /private_recommended_service_event_implementation/);
  assert.match(repair, /535f74f6fc17c6ae54696e13246307e0/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 9274/i);
  assert.match(repair, /set version = '0094'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0094 staging reconciliation is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical_rows = 1 and matching_rows = 1 and source_version = '0094'/i);
  assert.match(repair, /canonical migration version 0094 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0094/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.(?:recommendation_events|services|listings)\b/i);
});

test('0094 evidence records hosted attribution privacy, canonical ledger state and no production change', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Generated version \| `20260730210406`/);
  assert.match(evidence, /Statement MD5 \| `535f74f6fc17c6ae54696e13246307e0`/);
  assert.match(evidence, /Statement length \| 9274/);
  assert.match(evidence, /Canonical migration rows \| 94/);
  assert.match(evidence, /Last version \| `0094`/);
  assert.match(evidence, /Remaining generated versions \| 0/);
  assert.match(evidence, /Private volatile `SECURITY DEFINER` implementations \| 1/);
  assert.match(evidence, /Public volatile `SECURITY INVOKER` wrappers \| 1/);
  assert.match(evidence, /Stored event count \| 2 aggregate-safe rows/);
  assert.match(evidence, /Paused service target \| Rejected with SQLSTATE `22023`/);
  assert.match(evidence, /Anonymous raw-event table read \| Denied/);
  assert.match(evidence, /Unsafe context fields \| 0/);
  assert.match(evidence, /Residual recommendation events after rollback \| 0/);
  assert.match(evidence, /no longer reports `public\.record_recommended_service_event_v1`/i);
  assert.match(evidence, /production[\s\S]{0,180}remains migration `0049`/i);
});
