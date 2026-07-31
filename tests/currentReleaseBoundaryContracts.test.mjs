import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sqlBoundary, hygiene, migrationWorkflow] = await Promise.all([
  readFile(new URL('../scripts/verify-sql-boundary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-repository-hygiene.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
]);

test('the reviewed SQL release tip is migration 0100', () => {
  assert.match(sqlBoundary, /0100_release_control_consistency\.sql/);
  assert.match(sqlBoundary, /latest expected migration is 0100/);
});

test('repository hygiene deterministically rejects unfinished source markers', () => {
  for (const marker of ['TODO', 'FIXME', 'HACK', 'XXX']) assert.match(hygiene, new RegExp(`\\b${marker}\\\\b`));
  assert.match(hygiene, /not implemented/);
  assert.match(hygiene, /placeholder implementation/);
  assert.match(hygiene, /supabase\/functions\//);
  assert.match(hygiene, /markerScannedFiles/);
});

test('clean database CI executes the 0100 pgTAP matrix', () => {
  assert.match(migrationWorkflow, /v1_release_control_consistency\.sql/);
});
