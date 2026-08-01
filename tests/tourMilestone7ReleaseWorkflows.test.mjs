import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [releaseWorkflow, acceptanceWorkflow, stagingWorkflow, validator, supabaseConfig] = await Promise.all([
  read('.github/workflows/release-candidate-gates.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('.github/workflows/deploy-staging-pages.yml'),
  read('scripts/validate-env.mjs'),
  read('supabase/config.toml'),
]);

test('release candidate CI runs the complete locked static and build boundary', () => {
  assert.match(releaseWorkflow, /npm ci --include=dev --ignore-scripts/);
  for (const gate of [
    'npm run validate:env', 'npm run verify:source-graph', 'npm run test:contracts',
    'npm run test:tours-contracts', 'npm run lint', 'npm run typecheck',
    'npm run typecheck:migration', 'npm run typecheck:active', 'npm run build',
    'npm run audit:production',
  ]) assert.match(releaseWorkflow, new RegExp(gate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(releaseWorkflow, /VITE_FEATURE_TOURS: "true"/);
  assert.match(releaseWorkflow, /FINDIT_TOURS_RELEASE_ACCEPTED: "true"/);
  assert.match(releaseWorkflow, /FINDIT_TOURS_WORKERS_ENABLED: "true"/);
  assert.match(releaseWorkflow, /FINDIT_TOUR_PROCESSOR_MODE: "github-actions"/);
  assert.match(releaseWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: "true"/);
  assert.match(releaseWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(releaseWorkflow, /FINDIT_RECOMMENDATION_WORKERS_ENABLED: "true"/);
  assert.match(releaseWorkflow, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
});

test('staging acceptance is manual, guarded, comprehensive and emits a named record', () => {
  assert.match(acceptanceWorkflow, /workflow_dispatch/);
  assert.match(acceptanceWorkflow, /environment: staging-tours/);
  assert.match(acceptanceWorkflow, /npm ci --include=dev --ignore-scripts/);
  assert.match(acceptanceWorkflow, /FINDIT_ALLOW_HOSTED_SMOKE: staging/);
  assert.match(acceptanceWorkflow, /FINDIT_ALLOW_STAGING_FOUNDER_SESSION: staging/);
  assert.match(acceptanceWorkflow, /FINDIT_EXPECTED_PROJECT_REF/);
  assert.match(acceptanceWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: "true"/);
  assert.match(acceptanceWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(acceptanceWorkflow, /FINDIT_RECOMMENDATION_WORKERS_ENABLED: "true"/);
  assert.match(acceptanceWorkflow, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
  for (const requiredFlag of [
    'VITE_FEATURE_GOOGLE_OAUTH',
    'VITE_FEATURE_INTERNATIONAL_LISTING',
    'VITE_FEATURE_MANUAL_LOCATION',
    'VITE_FEATURE_CURRENT_LOCATION',
    'VITE_FEATURE_REPORTING',
  ]) assert.match(acceptanceWorkflow, new RegExp(`${requiredFlag}: "true"`));
  for (const closedFlag of [
    'VITE_FEATURE_LISTING_EXPIRY',
    'VITE_FEATURE_LISTING_FRESHNESS_REMINDERS',
    'VITE_FEATURE_PREVIEW_FIXTURES',
    'VITE_PREVIEW_AUTH_BYPASS',
  ]) assert.match(acceptanceWorkflow, new RegExp(`${closedFlag}: "false"`));
  assert.match(acceptanceWorkflow, /FINDIT_TOUR_PROCESSOR_MODE: "github-actions"/);
  assert.match(acceptanceWorkflow, /apt-get install --yes --no-install-recommends ffmpeg/);
  assert.match(acceptanceWorkflow, /ffmpeg -hide_banner -version/);
  for (const gate of [
    'test:tours-upload-hosted', 'test:tours-processing-hosted', 'test:tours-seller-hosted',
    'test:tours-integration-hosted', 'test:tours-discovery-hosted', 'test:tours-moderation-hosted',
    'test:tours-scale-hosted', 'test:messaging-scale-hosted', 'test:search-scale-hosted',
    'test:notification-scale-hosted', 'test:tours-observability-hosted',
  ]) assert.match(acceptanceWorkflow, new RegExp(gate));
  assert.match(acceptanceWorkflow, /npm run typecheck:edge-functions/);
  assert.match(acceptanceWorkflow, /tour-acceptance-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/);
  assert.match(acceptanceWorkflow, /tours-staging-acceptance\.json/);
  assert.match(acceptanceWorkflow, /retention-days: 90/);
});

test('staging deployment can expose preview or public Tours without weakening production gates', () => {
  assert.match(stagingWorkflow, /VITE_MODE: staging/);
  assert.match(stagingWorkflow, /npm ci --include=dev --ignore-scripts/);
  assert.match(stagingWorkflow, /VITE_BASE_PATH: \/findit-marketplace\//);
  assert.match(supabaseConfig, /site_url = "https:\/\/findit-marketplace-staging\.vercel\.app\/"/);
  assert.match(supabaseConfig, /"https:\/\/findit-marketplace-staging\.vercel\.app\/\*\*"/);
  assert.doesNotMatch(`${stagingWorkflow}\n${supabaseConfig}`, /\/-findit-marketplace\//);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_PREVIEW/);
  assert.match(stagingWorkflow, /FINDIT_STAGING_TOURS_BACKEND_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_TOUR_PROCESSOR_MODE: "github-actions"/);
  assert.match(stagingWorkflow, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(stagingWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(stagingWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED/);
  assert.match(stagingWorkflow, /FINDIT_TOURS_RELEASE_ACCEPTED: \$\{\{ vars\.FINDIT_TOURS_RELEASE_ACCEPTED \}\}/);
  assert.match(stagingWorkflow, /FINDIT_TOURS_ACCEPTANCE_ID: \$\{\{ vars\.FINDIT_TOURS_ACCEPTANCE_ID \}\}/);
  for (const requiredFlag of [
    'VITE_FEATURE_GOOGLE_OAUTH',
    'VITE_FEATURE_INTERNATIONAL_LISTING',
    'VITE_FEATURE_MANUAL_LOCATION',
    'VITE_FEATURE_CURRENT_LOCATION',
    'VITE_FEATURE_REPORTING',
  ]) assert.match(stagingWorkflow, new RegExp(`${requiredFlag}: "true"`));
  for (const closedFlag of [
    'VITE_FEATURE_PREVIEW_FIXTURES',
    'VITE_PREVIEW_AUTH_BYPASS',
    'VITE_FEATURE_LISTING_EXPIRY',
    'VITE_FEATURE_LISTING_FRESHNESS_REMINDERS',
  ]) assert.match(stagingWorkflow, new RegExp(`${closedFlag}: "false"`));
  assert.match(stagingWorkflow, /FINDIT_RECOMMENDATION_WORKERS_ENABLED: \$\{\{ vars\.FINDIT_RECOMMENDATION_WORKERS_ENABLED \}\}/);
  assert.match(stagingWorkflow, /FINDIT_RECOMMENDATION_WORKER_SECRET/);
});

test('preview access cannot be enabled without the complete backend worker boundary', () => {
  assert.match(validator, /toursPreviewEnabled/);
  assert.match(validator, /toursBrowserEnabled \|\| toursPreviewEnabled/);
  assert.match(validator, /Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true/);
  assert.match(validator, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(validator, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED must be true for production essential notifications/);
});
