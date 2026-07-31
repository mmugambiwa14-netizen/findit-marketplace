// src/lib/featureFlags.js
//
// Central switchboard for capabilities that are disabled-not-deleted. A flag
// exposes a real product contract only after its implementation, provider and
// release evidence are complete in the target environment.

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

const flag = (envVar, fallback = false) => {
  const raw = viteEnv[envVar];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === true;
};

export const featureFlags = {
  businessProfiles: flag('VITE_FEATURE_BUSINESS_PROFILES', true),
  messaging: flag('VITE_FEATURE_MESSAGING'),
  essentialNotifications: flag('VITE_FEATURE_ESSENTIAL_NOTIFICATIONS'),

  tours: flag('VITE_FEATURE_TOURS'),
  toursPreview: flag('VITE_FEATURE_TOURS_PREVIEW', Boolean(viteEnv.DEV)),
  previewFixtures: flag('VITE_FEATURE_PREVIEW_FIXTURES'),

  // Maps use MapLibre GL JS with MapTiler Cloud styles. Device location uses
  // MapTiler reverse geocoding and resolves only to a supported public city.
  maps: flag('VITE_FEATURE_MAPS'),
  manualLocation: flag('VITE_FEATURE_MANUAL_LOCATION', true),
  currentLocation: flag('VITE_FEATURE_CURRENT_LOCATION'),

  googleOAuth: flag('VITE_FEATURE_GOOGLE_OAUTH', flag('VITE_AUTH_GOOGLE_ENABLED')),
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
