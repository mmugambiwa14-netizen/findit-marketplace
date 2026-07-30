import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [repair, evidence] = await Promise.all([
  read('supabase/maintenance/reconcile_staging_migration_history_0099.sql'),
  read('docs/certification/staging-migration-ledger-reconciliation-0099-2026-07-31.md'),
]);

test('0099 repair verifies the exact personalization migration identity', () => {
  assert.match(repair, /version='0099'/);
  assert.match(repair, /private_personalization_preference_implementations/);
  assert.match(repair, /312c6f522a12cfed915b679ede33bf59/);
  assert.match(repair, /length\(array_to_string\(statements,E'\\n'\)\)=9571/);
  assert.match(repair, /source_version !~ '\^20260730\[0-9\]\{6\}\$'/);
});

test('0099 repair is ledger-only and production-excluded', () => {
  assert.match(repair, /lock table supabase_migrations\.schema_migrations/);
  assert.match(repair, /canonical_rows=1 and matching_rows=1 and source_version='0099'/);
  assert.match(repair, /Do not run against production/);
  assert.doesNotMatch(repair, /\bcreate\s+(?:table|function|view|index|policy)\b/i);
  assert.doesNotMatch(repair, /\balter\s+(?:table|function|view|extension|policy)\b/i);
  assert.doesNotMatch(repair, /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.doesNotMatch(repair, /\bupdate\s+public\.recommendation_personalization_preferences\b/i);
});

test('0099 evidence records canonical ledger, consent isolation and advisor clearance', () => {
  assert.match(evidence, /Generated version \| `20260730234710`/);
  assert.match(evidence, /Statement MD5 \| `312c6f522a12cfed915b679ede33bf59`/);
  assert.match(evidence, /Canonical rows \| 99/);
  assert.match(evidence, /Last version \| `0099`/);
  assert.match(evidence, /Private `SECURITY DEFINER` implementations \| 3/);
  assert.match(evidence, /Public `SECURITY INVOKER` wrappers \| 3/);
  assert.match(evidence, /No stored preference returns default-off \| Passed/);
  assert.match(evidence, /Other account preference \| Unchanged/);
  assert.match(evidence, /Owner event \| Removed/);
  assert.match(evidence, /Suspended-account update \| Rejected with SQLSTATE `42501`/);
  assert.match(evidence, /Residual events after rollback \| 0/);
  assert.match(evidence, /no longer reports these authenticated-callable/);
  assert.match(evidence, /anonymous-callable definer category remains at zero/i);
  assert.match(evidence, /production[\s\S]{0,140}migration `0049`/i);
});
