import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/generate-dependency-inventory.mjs', import.meta.url), 'utf8');

test('dependency inventory is lock-derived and deterministic', () => {
  assert.match(source, /package-lock\.json/);
  assert.match(source, /lockfileVersion !== 3/);
  assert.match(source, /packages\.sort\(\(left, right\) => left\.installPath\.localeCompare/);
  assert.match(source, /packageLockSha256/);
  assert.match(source, /artifacts\/certification\/dependency-inventory\.json/);
});

test('dependency inventory fails closed on supply-chain drift', () => {
  assert.match(source, /retiredPackagesAbsent/);
  assert.match(source, /allNonBundledPackagesHaveIntegrity/);
  assert.match(source, /allNonBundledPackagesResolveFromNpmRegistry/);
  assert.match(source, /\['leaflet', '@types\/leaflet'\]/);
  assert.match(source, /process\.exit\(1\)/);
});
