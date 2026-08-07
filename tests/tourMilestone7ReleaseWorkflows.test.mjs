import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [releaseWorkflow, acceptanceWorkflow, previewWorkflow, validator] = await Promise.all([
  read('.github/workflows/release-candidate-gates.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('.github/workflows/peekalisting-preview.yml'),
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

test('complete-stage preview exposes Peeks and current business flows only against isolated staging', () => {
  assert.match(previewWorkflow, /integration\/complete-current-stage/);
  assert.match(previewWorkflow, /github\.ref == 'refs\/heads\/integration\/complete-current-stage'/);
  assert.match(previewWorkflow, /VITE_MODE: staging/);
  assert.match(previewWorkflow, /VITE_BASE_PATH: \/findit-marketplace\//);
  assert.match(previewWorkflow, /VITE_PREVIEW_DEPLOYMENT: "true"/);
  assert.match(previewWorkflow, /npm ci --include=dev --ignore-scripts/);
  assert.match(previewWorkflow, /VITE_FEATURE_CURATED_BUSINESS_MARKETPLACE: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_BUSINESS_PROFILES: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_MESSAGING: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_ESSENTIAL_NOTIFICATIONS: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_TOURS: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_TOURS_PREVIEW: "true"/);
  assert.match(previewWorkflow, /TOURS_BACKEND_ENABLED: "true"/);
  assert.match(previewWorkflow, /VITE_FEATURE_PREVIEW_FIXTURES: "true"/);
  assert.match(previewWorkflow, /VITE_PREVIEW_AUTH_BYPASS: "false"/);
  assert.match(previewWorkflow, /VITE_FEATURE_INTERNATIONAL_LISTING: "false"/);
  assert.match(previewWorkflow, /bwgklpxoetrrkutottdb/);
  assert.match(previewWorkflow, /BusinessPublishingGate/);
  assert.match(previewWorkflow, /BuyerPeekRequests/);
  assert.match(previewWorkflow, /BusinessProfiles/);
  assert.match(previewWorkflow, /preview-build\.json/);
  assert.match(previewWorkflow, /"scope":"complete-current-stage"/);
  assert.match(previewWorkflow, /create-pages-spa-fallback\.mjs dist "\$VITE_BASE_PATH"/);
});

test('preview access cannot be enabled without the complete backend worker boundary', () => {
  assert.match(validator, /toursPreviewEnabled/);
  assert.match(validator, /toursBrowserEnabled \|\| toursPreviewEnabled/);
  assert.match(validator, /Tour browser or preview access cannot be enabled unless TOURS_BACKEND_ENABLED is true/);
  assert.match(validator, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(validator, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED must be true for production essential notifications/);
});
