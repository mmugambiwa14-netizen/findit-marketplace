import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixtures = await readFile(
  new URL('../scripts/lib/tour-smoke-fixtures.mjs', import.meta.url),
  'utf8',
);

test('local Edge cold-start readiness is separate from each one-shot functional request', () => {
  assert.match(fixtures, /const EDGE_READY_ATTEMPTS = 3/);
  assert.match(fixtures, /method: 'OPTIONS'/);
  assert.match(fixtures, /response\.status !== 546/);
  assert.match(fixtures, /await ensureEdgeFunctionReady\(name\);[\s\S]*method: 'POST'/);
  assert.doesNotMatch(fixtures, /method: 'POST'[\s\S]{0,600}EDGE_READY_ATTEMPTS/);
});
