import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0091.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0091-2026-07-30.md'),
]);

test('0091 staging reconciliation verifies the exact Tour-summary migration identity', () => {
  assert.match(repair, /where version = '0091'/i);
  assert.match(repair, /private_public_tour_summaries_implementation/);
  assert.match(repair, /1ffbe7e117d538c27bb133acd67bd045/);
  assert.match(repair, /length\(array_to_string\(statements, E'\\n'\)\) = 8676/i);
  assert.match(repair, /set version = '0091'/i);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/i);
});

test('0091 staging reconciliation is idempotent, ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/i);
  assert.match(repair, /canonical_rows = 1 and matching_rows = 1 and source_version = '0091'/i);
  assert.match(repair, /canonical migration version 0091 is already occupied/i);
  assert.match(repair, /expected exactly one verified source row for migration 0091/i);
  assert.match(repair, /Do not run against production/i);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
});

test('0091 evidence records canonical Tour-summary hardening and no production change', () => {
  assert.match(evidence, /bwgklpxoetrrkutottdb/);
  assert.match(evidence, /Generated version \| `20260730201809`/);
  assert.match(evidence, /Canonical migration rows \| 91/);
  assert.match(evidence, /Last version \| `0091`/);
  assert.match(evidence, /Remaining generated versions \| 0/);
  assert.match(evidence, /Private Peek-summary definers \| 1/);
  assert.match(evidence, /Public Peek-summary invoker wrappers \| 1/);
  assert.match(evidence, /Listing parent ceiling \| 100; 101 rejected with `22023`/);
  assert.match(evidence, /Service parent ceiling \| 100; 101 rejected with `22023`/);
  assert.match(evidence, /clearing\s+two targeted warnings/i);
  assert.match(evidence, /production[\s\S]{0,180}remains at migration `0049`/i);
});
