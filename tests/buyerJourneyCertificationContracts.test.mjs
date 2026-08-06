import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runnerUrl = new URL('../scripts/certify-buyer-journey.mjs', import.meta.url);
const blockerLedgerUrl = new URL('../docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md', import.meta.url);

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
  assert.match(runner, /if \(result\.status === 'failed'\)[\s\S]*break;/);
  assert.match(runner, /artifacts\/certification\/buyer-journey\.json/);
  assert.match(runner, /process\.exitCode = report\.status === 'failed' \? 1 : 0/);
  assert.match(runner, /output\.length > 40000/);
});

test('repository contracts run without hosted credentials and hosted stages are skipped', async () => {
  const runner = await source();
  assert.match(runner, /buyerJourneyCertificationContracts\.test\.mjs/);
  assert.match(runner, /hostedEnvironmentAvailable/);
  assert.match(runner, /Hosted Supabase credentials are unavailable/);
  assert.match(runner, /repository-passed-hosted-pending/);
});

test('hosted certification remains explicitly recorded as pending until executed', async () => {
  const ledger = await readFile(blockerLedgerUrl, 'utf8');
  assert.match(ledger, /Stage 1 — Buyer journey/);
  assert.match(ledger, /Implemented; hosted certification pending/);
  assert.match(ledger, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(ledger, /remains a launch blocker/);
});
