import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0096.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0096-2026-07-31.md'),
]);

test('0096 repair verifies exact recommendation-event migration identity', () => {
  assert.match(repair, /version='0096'/);
  assert.match(repair, /private_recommendation_event_implementation/);
  assert.match(repair, /954932bc89a0e80ac7e73c277b6edf0b/);
  assert.match(repair, /length\(array_to_string\(statements,E'\\n'\)\)=7054/);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/);
});

test('0096 repair is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/);
  assert.match(repair, /canonical_rows=1 and matching_rows=1 and source_version='0096'/);
  assert.match(repair, /Do not run against production/);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
});

test('0096 evidence records canonical ledger, event privacy and no production change', () => {
  assert.match(evidence, /Generated version \| `20260730231129`/);
  assert.match(evidence, /Statement MD5 \| `954932bc89a0e80ac7e73c277b6edf0b`/);
  assert.match(evidence, /Canonical rows \| 96/);
  assert.match(evidence, /Last version \| `0096`/);
  assert.match(evidence, /Private volatile `SECURITY DEFINER` \| 1/);
  assert.match(evidence, /Public volatile `SECURITY INVOKER` \| 1/);
  assert.match(evidence, /Anonymous raw-event read \| Denied/);
  assert.match(evidence, /Invasive context field \| Rejected with SQLSTATE `22023`/);
  assert.match(evidence, /Anonymous save event \| Rejected with SQLSTATE `42501`/);
  assert.match(evidence, /Residual events \| 0/);
  assert.match(evidence, /only remaining anonymous-callable definer finding/);
  assert.match(evidence, /production[\s\S]{0,140}migration `0049`/i);
});
