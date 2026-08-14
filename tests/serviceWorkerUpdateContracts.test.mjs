import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'serviceWorker.js'),
  'utf8',
);
const pushWorker = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'push-sw.js'),
  'utf8',
);

test('update activation can recover the registration when the original reference is stale', () => {
  assert.match(source, /navigator\.serviceWorker\.getRegistration\('\/'\)/);
  assert.match(source, /await activeRegistration\.update\(\)/);
});

test('update activation binds controllerchange and has a bounded reload fallback', () => {
  assert.match(source, /addEventListener\('controllerchange', reloadAfterActivation\)/);
  assert.match(source, /activationFallbackTimer = window\.setTimeout/);
  assert.match(source, /}, 5000\);/);
});

test('canonical staging automatically promotes its worker after installation', () => {
  assert.match(pushWorker, /CANONICAL_STAGING_HOST = 'staging\.peekalisting\.com'/);
  assert.match(pushWorker, /hostname === CANONICAL_STAGING_HOST/);
  assert.match(pushWorker, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});
