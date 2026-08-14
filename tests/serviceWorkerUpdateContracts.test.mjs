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
const provider = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'pwa', 'PwaProvider.jsx'),
  'utf8',
);

test('update activation can recover the registration when the original reference is stale', () => {
  assert.match(source, /navigator\.serviceWorker\.getRegistration\('\/'\)/);
  assert.match(source, /await activeRegistration\.update\(\)/);
});

test('update activation binds controllerchange and has a bounded reload fallback', () => {
  assert.match(source, /addEventListener\('controllerchange', reloadAfterActivation\)/);
  assert.match(source, /waiting\.addEventListener\('statechange', handleWaitingStateChange\)/);
  assert.match(source, /activationFallbackTimer = window\.setTimeout/);
  assert.match(source, /}, ACTIVATION_FALLBACK_MS\);/);
  assert.match(source, /const ACTIVATION_FALLBACK_MS = 2500/);
});

test('the update banner clears immediately and restores only if activation fails', () => {
  assert.match(provider, /setApplyingUpdate\(true\)/);
  assert.match(provider, /setUpdateReady\(false\)/);
  assert.match(provider, /setApplyingUpdate\(false\)/);
  assert.match(provider, /setUpdateReady\(true\)/);
});

test('canonical staging automatically promotes its worker after installation', () => {
  assert.match(pushWorker, /CANONICAL_STAGING_HOST = 'staging\.peekalisting\.com'/);
  assert.match(pushWorker, /hostname === CANONICAL_STAGING_HOST/);
  assert.match(pushWorker, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});
