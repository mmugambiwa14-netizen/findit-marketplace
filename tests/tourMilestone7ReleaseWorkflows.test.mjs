import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [releaseWorkflow, acceptanceWorkflow, stagingWorkflow, validator] = await Promise.all([
  read('.github/workflows/release-candidate-gates.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('.github/workflows/deploy-staging-pages.yml'),
  read('scripts/validate-env.mjs'),
]);

test('release candidate CI runs the complete locked static and build boundary', () => {
  assert.match(releaseWorkflow, /npm ci --include=dev --ignore-scripts/);
  for (const gate of [
    'npm run validate:env', 'npm run verify:source-graph', 'npm run test:contracts',
    'npm run test:tours-contracts', 'npm run lint', 'npm run typecheck',
    'npm run typecheck:migration', 'npm run typecheck:active', 'npm run build',
    'npm run audit:production',
  ]) assert.match(releaseWorkflow, new RegExp(gate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(releaseWorkflow, /VITE_FEATURE_TOURS: "false"/);
  assert.match(releaseWorkflow, /FINDIT_TOURS_RELEASE_ACCEPTED: "false"/);
  assert.match(releaseWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: "true"/);
  assert.match(releaseWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
});

test('staging acceptance is manual, guarded, comprehensive and emits a named record', () => {
  assert.match(acceptanceWorkflow, /workflow_dispatch/);
  assert.match(acceptanceWorkflow, /environment: staging-tours/);
  assert.match(acceptanceWorkflow, /FINDIT_ALLOW_HOSTED_SMOKE: staging/);
  assert.match(acceptanceWorkflow, /FINDIT_EXPECTED_PROJECT_REF/);
  assert.match(acceptanceWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: "true"/);
  assert.match(acceptanceWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  for (const gate of [
    'test:tours-upload-hosted', 'test:tours-processing-hosted', 'test:tours-seller-hosted',
    'test:tours-integration-hosted', 'test:tours-discovery-hosted', 'test:tours-moderation-hosted',
    'test:tours-scale-hosted', 'test:messaging-scale-hosted', 'test:search-scale-hosted',
    'test:notification-scale-hosted', 'test:tours-observability-hosted',
  ]) assert.match(acceptanceWorkflow, new RegExp(gate));
  assert.match(acceptanceWorkflow, /tour-acceptance-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/);
  assert.match(acceptanceWorkflow, /tours-staging-acceptance\.json/);
  assert.match(acceptanceWorkflow, /retention-days: 90/);
});

test('staging deployment can expose preview or public Tours without weakening production gates', () => {
  assert.match(stagingWorkflow, /VITE_MODE: staging/);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_PREVIEW/);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_BACKEND_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(stagingWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(stagingWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_TOURS_RELEASE_ACCEPTED: "false"/);
});

test('preview access cannot be enabled without the complete backend worker boundary', () => {
  assert.match(validator, /toursPreviewEnabled/);
  assert.match(validator, /toursBrowserEnabled \|\| toursPreviewEnabled/);
  assert.match(validator, /Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true/);
  assert.match(validator, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(validator, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED must be true for production essential notifications/);
});
