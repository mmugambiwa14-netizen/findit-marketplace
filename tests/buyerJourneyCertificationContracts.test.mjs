import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runnerUrl = new URL('../scripts/certify-buyer-journey.mjs', import.meta.url);

async function source() {
  return readFile(runnerUrl, 'utf8');
}

test('buyer journey certifies every required backend capability in order', async () => {
  const runner = await source();
  const required = [
    'phase7-search-scale-smoke-local.mjs',
    'tours-public-catalogue-smoke-local.mjs',
    'tours-listing-integration-smoke-local.mjs',
    'phase3-notifications-smoke-local.mjs',
    'phase3-messaging-smoke-local.mjs',
  ];
  let previous = -1;
  for (const script of required) {
    const position = runner.indexOf(script);
    assert.notEqual(position, -1, `${script} must remain in buyer certification`);
    assert.ok(position > previous, `${script} is out of journey order`);
    previous = position;
  }
});

test('buyer certification fails fast and persists a machine-readable report', async () => {
  const runner = await source();
  assert.match(runner, /if \(result\.status !== 'passed'\)[\s\S]*break;/);
  assert.match(runner, /artifacts\/certification\/buyer-journey\.json/);
  assert.match(runner, /process\.exitCode = 1/);
  assert.match(runner, /stdout\.slice\(-20_000\)/);
  assert.match(runner, /stderr\.slice\(-20_000\)/);
});

test('missing smoke programs prevent a false certification start', async () => {
  const runner = await source();
  assert.match(runner, /access\(resolve\(script\), constants\.R_OK\)/);
});
