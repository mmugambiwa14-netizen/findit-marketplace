import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sqlBoundary, hygiene, migrationWorkflow] = await Promise.all([
  readFile(new URL('../scripts/verify-sql-boundary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-repository-hygiene.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/migration-gates.yml', import.meta.url), 'utf8'),
]);

// This anchor is deliberately duplicated between the verifier and this test so
// that adding a migration cannot silently move the reviewed release tip --
// whoever bumps it has to touch both, and say so in review.
test('the reviewed SQL release tip is migration 0116', () => {
  assert.match(sqlBoundary, /0116_peek_threads_foundation\.sql/);
  assert.match(sqlBoundary, /RELEASE_TIP_MIGRATION/);
  // The previous tip stays referenced in the reviewed-tips list above it, so a
  // reader can trace the chain rather than seeing it vanish.
  assert.match(sqlBoundary, /0108_location_registry_parent_index_deduplication\.sql/);
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
