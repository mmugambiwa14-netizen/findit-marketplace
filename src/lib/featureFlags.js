// src/lib/featureFlags.js
//
// Central switchboard for capabilities that are disabled-not-deleted. A flag
// exposes a real product contract only after its implementation, provider and
// release evidence are complete in the target environment.

import { mapProviderConfigured } from './mapProvider.js';

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

const STAGING_BRANCHES = new Set([
  'feature/listing-intelligence-foundation',
  'claude/findit-hardening-listing-012cf0',
  'feature/peek-threads-phase-3',
]);
const deploymentBranch = String(viteEnv.VITE_VERCEL_GIT_COMMIT_REF ?? '').trim();
const isStagingBranch = STAGING_BRANCHES.has(deploymentBranch);

const flag = (envVar, fallback = false) => {
  const raw = viteEnv[envVar];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === true;
};

// These capabilities have already crossed their repository implementation
// boundary on the trusted staging lineage. Vercel Preview and Production use
// separate environment-variable scopes; an older Preview value of `false`
// must not silently remove a capability that is visible on persistent staging.
// Production outside this staging lineage remains governed by its explicit
// environment value and therefore still fails closed.
const stagingCertifiedFlag = (envVar) => isStagingBranch || flag(envVar, false);

// Authentication providers are slightly stricter than ordinary UI features:
// trusted staging branches inherit the configured provider, but an explicit
// false value remains an emergency off switch in every environment.
const stagingProviderFlag = (envVar, legacyEnvVar) => {
  const raw = viteEnv[envVar] ?? viteEnv[legacyEnvVar];
  if (raw === 'false' || raw === false) return false;
  return isStagingBranch || raw === 'true' || raw === true;
};

export const featureFlags = {
  businessProfiles: flag('VITE_FEATURE_BUSINESS_PROFILES', true),
  messaging: stagingCertifiedFlag('VITE_FEATURE_MESSAGING'),
  essentialNotifications: stagingCertifiedFlag('VITE_FEATURE_ESSENTIAL_NOTIFICATIONS'),

  tours: stagingCertifiedFlag('VITE_FEATURE_TOURS'),
  toursPreview: flag('VITE_FEATURE_TOURS_PREVIEW', Boolean(viteEnv.DEV)),
  previewFixtures: flag('VITE_FEATURE_PREVIEW_FIXTURES'),

  // Map rendering is available whenever the provider stack is configured.
  // Device location is independently consent-gated and resolves through the
  // first-party Supabase/PostGIS registry rather than a map-tile provider.
  maps: flag('VITE_FEATURE_MAPS', mapProviderConfigured()),
  manualLocation: flag('VITE_FEATURE_MANUAL_LOCATION', true),
  currentLocation: stagingCertifiedFlag('VITE_FEATURE_CURRENT_LOCATION'),

  googleOAuth: stagingProviderFlag(
    'VITE_FEATURE_GOOGLE_OAUTH',
    'VITE_AUTH_GOOGLE_ENABLED',
  ),
  reporting: flag('VITE_FEATURE_REPORTING', true),

  // These contracts are deliberately fail-closed until complete end-to-end
  // implementations exist. Setting an environment variable alone is rejected
  // by scripts/validate-env.mjs.
  phoneVerification: flag('VITE_FEATURE_PHONE_VERIFICATION'),
  currencyConversion: flag('VITE_FEATURE_CURRENCY_CONVERSION'),
  internationalListing: flag('VITE_FEATURE_INTERNATIONAL_LISTING'),
  serviceRadius: flag('VITE_FEATURE_SERVICE_RADIUS'),
  listingExpiry: flag('VITE_FEATURE_LISTING_EXPIRY'),
  listingFreshnessReminders: flag('VITE_FEATURE_LISTING_FRESHNESS_REMINDERS'),

  payments: flag('VITE_FEATURE_PAYMENTS'),
  subscriptions: flag('VITE_FEATURE_SUBSCRIPTIONS'),
  escrow: flag('VITE_FEATURE_ESCROW'),
  premiumListings: flag('VITE_FEATURE_PREMIUM_LISTINGS'),

  aiContentModeration: flag('VITE_FEATURE_AI_MODERATION'),
  aiBanEvasionDetection: flag('VITE_FEATURE_AI_BAN_EVASION'),
  aiTicketTriage: flag('VITE_FEATURE_AI_TICKET_TRIAGE'),
  aiSupportChat: flag('VITE_FEATURE_AI_SUPPORT_CHAT'),

  scheduledReminders: flag('VITE_FEATURE_SCHEDULED_REMINDERS'),
  marketingEmails: flag('VITE_FEATURE_MARKETING_EMAILS'),
};
