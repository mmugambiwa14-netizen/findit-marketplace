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

test('release clean database certification reuses the authoritative migration matrix', async () => {
  const workflow = await read('.github/workflows/release-certification.yml');
  const runner = await read('scripts/run-migration-database-certification.sh');
  assert.match(workflow, /bash \.\/scripts\/run-migration-database-certification\.sh/);
  assert.doesNotMatch(workflow, /Run complete pgTAP suite[\s\S]*supabase@2\.84\.2 test db/);
  assert.match(runner, /SUPABASE_CLI_VERSION="2\.84\.2"/);
  assert.match(runner, /supabase\/tests\/v1_curated_business_marketplace\.sql/);
  assert.match(runner, /supabase\/tests\/v1_recommendation_services\.sql/);
  assert.match(runner, /supabase\/tests\/v1_admin_mfa_assurance_boundary\.sql/);
  assert.doesNotMatch(workflow, /supabase\/setup-cli@v1/);
});

test('production build includes PWA and security verification', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.match(pkg.scripts.build, /vite build/);
  assert.match(pkg.scripts.build, /stamp-service-worker/);
  assert.match(pkg.scripts.build, /verify-built-boundary/);
  assert.match(pkg.scripts.build, /verify-bundle-secrets/);
  assert.match(pkg.scripts.build, /verify-build-budget/);
});

test('final orchestrator composes all five completed core journeys', async () => {
  const script = await read('scripts/certify-final-release.mjs');
  assert.match(script, /certify-buyer-journey/);
  assert.match(script, /certify-verified-business-journey/);
  assert.match(script, /certify-peek-fulfilment-journey/);
  assert.match(script, /certify-listing-publication-journey/);
  assert.match(script, /certify-safety-operations-journey/);
  assert.match(script, /repository-certified-hosted-pending/);
  assert.match(script, /final-release\.json/);
});

test('final orchestrator invokes the protected production audit through its npm entrypoint', async () => {
  const script = await read('scripts/certify-final-release.mjs');
  assert.match(script, /\['production-boundary',\s*npm,\s*\['run',\s*'audit:production',\s*'--silent'\]\]/);
  assert.doesNotMatch(script, /\['production-boundary',\s*node,\s*\['scripts\/audit-production\.mjs'\]\]/);
});

test('verified business and Peek fulfilment certifiers preserve hosted evidence boundaries', async () => {
  const business = await read('scripts/certify-verified-business-journey.mjs');
  const peek = await read('scripts/certify-peek-fulfilment-journey.mjs');
  assert.match(business, /verifiedBusinessJourneyContracts/);
  assert.match(business, /phase3-business-profiles-smoke/);
  assert.match(business, /verified-business-journey\.json/);
  assert.match(peek, /peekFulfilmentJourneyContracts/);
  assert.match(peek, /tours-seller-workflow-smoke/);
  assert.match(peek, /tours-processing-smoke/);
  assert.match(peek, /peek-fulfilment-journey\.json/);
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
