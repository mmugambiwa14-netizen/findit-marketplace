import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildArchitectureSnapshot } from '../scripts/generate-architecture-snapshot.mjs';

// The architecture snapshot is generated from the repository. This regenerates
// it into memory and compares, so a migration or Edge Function added without
// refreshing the docs fails here instead of leaving prose that quietly decays.
//
// This is the guard that the previous hand-counted figures never had:
// ARCHITECTURE.md claimed 29 migrations, 49 tables and four Edge Functions while
// the repository actually held 138, 90 and 28.

const snapshotPath = new URL('../docs/ARCHITECTURE_SNAPSHOT.md', import.meta.url);

test('the committed architecture snapshot matches the repository', async () => {
  const committed = await readFile(snapshotPath, 'utf8');
  const { snapshot } = await buildArchitectureSnapshot();

  // Rebuilt in memory: the test never writes, so a stale snapshot fails here
  // instead of being silently repaired by the act of running the suite.
  assert.equal(
    snapshot,
    committed,
    'docs/ARCHITECTURE_SNAPSHOT.md is stale. Run `npm run docs:architecture` and commit the result.',
  );
});

test('the snapshot records the boundaries that matter', async () => {
  const snapshot = await readFile(snapshotPath, 'utf8');

  assert.match(snapshot, /GENERATED FILE -- do not edit by hand/);
  assert.match(snapshot, /\| Migrations \| \d+ \|/);
  assert.match(snapshot, /\| Tables created \| \d+ \|/);
  assert.match(snapshot, /\| Tables with RLS enabled \| \d+ \|/);
  assert.match(snapshot, /\| pgTAP suites \| \d+ \|/);
  assert.match(snapshot, /## Edge Functions \(\d+\)/);
});

test('every table created in a migration still has RLS enabled', async () => {
  const snapshot = await readFile(snapshotPath, 'utf8');

  // The generator emits one sentence or the other; the failing form names the
  // offending tables so a regression is actionable rather than just red.
  assert.match(
    snapshot,
    /Every table created in a migration has row level security enabled\./,
    'a table was created without enable row level security -- see the snapshot for names',
  );
});

test('ARCHITECTURE.md defers to the generated snapshot instead of restating counts', async () => {
  const architecture = await readFile(new URL('../ARCHITECTURE.md', import.meta.url), 'utf8');

  assert.match(architecture, /ARCHITECTURE_SNAPSHOT\.md/);
  // Guard against the specific stale figures returning as prose.
  assert.doesNotMatch(architecture, /[Tt]wenty-nine Supabase migrations/);
  assert.doesNotMatch(architecture, /Four hosted Edge Functions/);
});
