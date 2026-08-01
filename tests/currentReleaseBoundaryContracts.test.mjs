import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sqlBoundary, hygiene, migrationWorkflow] = await Promise.all([
  readFile(new URL('../scripts/verify-sql-boundary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-repository-hygiene.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
]);

test('the reviewed SQL release tip is migration 0101', () => {
  assert.match(sqlBoundary, /0101_private_authenticated_rpc_implementations\.sql/);
  assert.match(sqlBoundary, /latest expected migration is 0101/);
});

test('repository hygiene deterministically rejects unfinished source markers', () => {
  for (const marker of ['TODO marker', 'FIXME marker', 'HACK marker', 'XXX marker']) assert.match(hygiene, new RegExp(marker));
  assert.match(hygiene, /not-implemented marker/);
  assert.match(hygiene, /placeholder implementation marker/);
  assert.match(hygiene, /supabase\/functions\//);
  assert.match(hygiene, /markerScannedFiles/);
});

test('clean database CI executes the 0101 pgTAP matrix', () => {
  assert.match(migrationWorkflow, /v1_private_authenticated_rpc_implementations\.sql/);
});
