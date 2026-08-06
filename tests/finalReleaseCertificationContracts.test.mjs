import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('release workflow targets canonical main only', async () => {
  const workflow = await read('.github/workflows/release-certification.yml');
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.doesNotMatch(workflow, /feature\/listing-intelligence-foundation/);
  assert.match(workflow, /repository-certification/);
  assert.match(workflow, /clean-database-certification/);
  assert.match(workflow, /hosted-release-certification/);
});

test('clean database certification starts empty and runs all pgTAP tests', async () => {
  const workflow = await read('.github/workflows/release-certification.yml');
  assert.match(workflow, /supabase start/);
  assert.match(workflow, /supabase db reset/);
  assert.match(workflow, /supabase test db/);
});

test('production build includes PWA and security verification', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.scripts.build, /vite build/);
  assert.match(pkg.scripts.build, /stamp-service-worker/);
  assert.match(pkg.scripts.build, /verify-built-boundary/);
  assert.match(pkg.scripts.build, /verify-bundle-secrets/);
  assert.match(pkg.scripts.build, /verify-build-budget/);
});

test('final orchestrator composes completed journey evidence', async () => {
  const script = await read('scripts/certify-final-release.mjs');
  assert.match(script, /certify-buyer-journey/);
  assert.match(script, /certify-listing-publication-journey/);
  assert.match(script, /certify-safety-operations-journey/);
  assert.match(script, /repository-certified-hosted-pending/);
  assert.match(script, /final-release\.json/);
});

test('bounded scale certification covers critical traffic paths', async () => {
  const script = await read('scripts/certify-release-scale.mjs');
  assert.match(script, /phase7-search-scale/);
  assert.match(script, /messaging-scale/);
  assert.match(script, /tours-scale/);
  assert.match(script, /notification-scale/);
  assert.match(script, /release-scale\.json/);
});

test('release report preserves no-review MVP boundary and external blockers', async () => {
  const report = await read('docs/certification/FINAL_RELEASE_READINESS.md');
  assert.match(report, /no routine human listing review queue/i);
  assert.match(report, /no routine human Peek approval queue/i);
  assert.match(report, /Public production launch: not yet certified/i);
  assert.match(report, /EXTERNAL_CERTIFICATION_BLOCKERS/);
  assert.match(report, /Only `main` represents the product/);
});

test('branch cleanup keeps unique packages and marks merged branches disposable', async () => {
  const ledger = await read('docs/certification/BRANCH_CLEANUP_LEDGER.md');
  assert.match(ledger, /feature\/peek-threads-phase-3/);
  assert.match(ledger, /feature\/contextual-permissions/);
  assert.match(ledger, /brand\/peekalisting-binoculars/);
  assert.match(ledger, /Safe to delete after Stage 6 merge/);
  assert.match(ledger, /develop/);
});
