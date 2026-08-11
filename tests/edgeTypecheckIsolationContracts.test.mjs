import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../scripts/edge-functions-typecheck.mjs', import.meta.url), 'utf8');

test('Edge Function typechecking cannot rewrite the locked application dependency tree', () => {
  assert.match(source, /--node-modules-dir=none/);
  assert.doesNotMatch(source, /--node-modules-dir=auto/);
  assert.match(source, /--no-lock/);
});
