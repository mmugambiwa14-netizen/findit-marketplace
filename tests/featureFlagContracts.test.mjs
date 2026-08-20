import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { collectActiveV1SourceGraph } from '../scripts/lib/activeV1SourceGraph.mjs';
import { featureFlags } from '../src/lib/featureFlags.js';

const projectRoot = resolve(import.meta.dirname, '..');
const testWorkerSecret = randomBytes(16).toString('hex');
const [appSource, packageSource] = await Promise.all([
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);

const deferredFlags = [
  'currencyConversion',
  'phoneVerification',
  'internationalListing',
  'serviceRadius',
  'payments',
  'subscriptions',
  'escrow',
  'premiumListings',
  'aiContentModeration',
  'aiBanEvasionDetection',
  'aiTicketTriage',
  'aiSupportChat',
  'scheduledReminders',
  'marketingEmails',
  'listingExpiry',
  'listingFreshnessReminders',
];

const releaseEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  VITE_MODE: 'production',
  VITE_SUPABASE_URL: 'https://findit-release-gate.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_release_gate_only',
  VITE_FEATURE_BUSINESS_PROFILES: 'true',
  VITE_FEATURE_MESSAGING: 'true',
  VITE_FEATURE_ESSENTIAL_NOTIFICATIONS: 'true',
  VITE_FEATURE_GOOGLE_OAUTH: 'true',
  VITE_AUTH_GOOGLE_ENABLED: 'true',
  VITE_FEATURE_MAPS: 'true',
  VITE_MAPTILER_PUBLIC_KEY: 'release-gate-maptiler-key',
  VITE_MAPTILER_STYLE_ID: 'streets-v4',
  VITE_FEATURE_INTERNATIONAL_LISTING: 'false',
  VITE_FEATURE_MANUAL_LOCATION: 'true',
  VITE_FEATURE_CURRENT_LOCATION: 'true',
  VITE_FEATURE_CURRENCY_CONVERSION: 'false',
  VITE_FEATURE_PHONE_VERIFICATION: 'false',
  VITE_FEATURE_SERVICE_RADIUS: 'false',
  VITE_FEATURE_REPORTING: 'true',
  VITE_FEATURE_PAYMENTS: 'false',
  VITE_FEATURE_SUBSCRIPTIONS: 'false',
  VITE_FEATURE_ESCROW: 'false',
  VITE_FEATURE_PREMIUM_LISTINGS: 'false',
  VITE_FEATURE_AI_MODERATION: 'false',
  VITE_FEATURE_AI_BAN_EVASION: 'false',
  VITE_FEATURE_AI_TICKET_TRIAGE: 'false',
  VITE_FEATURE_AI_SUPPORT_CHAT: 'false',
  VITE_FEATURE_SCHEDULED_REMINDERS: 'false',
  VITE_FEATURE_MARKETING_EMAILS: 'false',
  VITE_FEATURE_LISTING_EXPIRY: 'false',
  VITE_FEATURE_LISTING_FRESHNESS_REMINDERS: 'false',
  VITE_FEATURE_TOURS: 'false',
  VITE_FEATURE_TOURS_PREVIEW: 'false',
  VITE_FEATURE_PREVIEW_FIXTURES: 'false',
  VITE_PREVIEW_AUTH_BYPASS: 'false',
  TOURS_BACKEND_ENABLED: 'false',
  FINDIT_TOURS_RELEASE_ACCEPTED: 'false',
  FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED: 'true',
  FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET: testWorkerSecret,
  FINDIT_PLATFORM_MAINTENANCE_WORKERS_ENABLED: 'true',
  FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET: testWorkerSecret,
};

function validateRelease(overrides = {}) {
  return spawnSync(process.execPath, ['./scripts/validate-env.mjs'], {
    cwd: projectRoot,
    env: { ...releaseEnvironment, ...overrides },
    encoding: 'utf8',
  });
}

test('all deferred V1 flags default off', () => {
  for (const name of deferredFlags) assert.equal(featureFlags[name], false, `${name} must default off`);
});

test('the active route graph contains no commerce or premium screen', () => {
  const graph = collectActiveV1SourceGraph(projectRoot);
  const blocked = ['PaymentPage.jsx', 'Pricing.jsx', 'TransactionHistory.jsx', 'Step7Package.jsx', 'Step8Package.jsx'];
  const violations = graph.files.filter((file) => blocked.some((name) => file.endsWith(name)));
  assert.deepEqual(violations, []);
  assert.doesNotMatch(appSource, /path=["']\/(?:payment|pricing|transactions)/);

  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.dependencies['@stripe/react-stripe-js'], undefined);
  assert.equal(packageJson.dependencies['@stripe/stripe-js'], undefined);
});

test('the production release gate requires real MVP flags and rejects incomplete contracts', () => {
  assert.equal(validateRelease().status, 0);

  const wrongSupabaseProject = validateRelease({
    FINDIT_EXPECTED_PROJECT_REF: 'expected-production-ref',
  });
  assert.notEqual(wrongSupabaseProject.status, 0);
  assert.match(wrongSupabaseProject.stderr, /does not match FINDIT_EXPECTED_PROJECT_REF/);

  const commerceEnabled = validateRelease({ VITE_FEATURE_PAYMENTS: 'true' });
  assert.notEqual(commerceEnabled.status, 0);
  assert.match(commerceEnabled.stderr, /VITE_FEATURE_PAYMENTS must be false/);

  const mapsMissingProvider = validateRelease({ VITE_MAPTILER_PUBLIC_KEY: '' });
  assert.notEqual(mapsMissingProvider.status, 0);
  assert.match(mapsMissingProvider.stderr, /VITE_MAPTILER_PUBLIC_KEY is required/);

  const fakeInternationalRollout = validateRelease({ VITE_FEATURE_INTERNATIONAL_LISTING: 'true' });
  assert.notEqual(fakeInternationalRollout.status, 0);
  assert.match(fakeInternationalRollout.stderr, /complete product contract/);

  const unverifiedPhone = validateRelease({ VITE_FEATURE_PHONE_VERIFICATION: 'true' });
  assert.notEqual(unverifiedPhone.status, 0);
  assert.match(unverifiedPhone.stderr, /complete product contract/);

  const missingManualFallback = validateRelease({ VITE_FEATURE_MANUAL_LOCATION: 'false' });
  assert.notEqual(missingManualFallback.status, 0);
  assert.match(missingManualFallback.stderr, /privacy-safe fallback/);
});
