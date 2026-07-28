// src/lib/featureFlags.js
//
// Central switchboard for features that are disabled-not-deleted for MVP
// launch (payments, AI automation) per the agreed migration plan. Every flag
// here defaults OFF for capabilities being held back, and can be flipped
// without any code change elsewhere once the feature is ready to return --
// that's the whole point of flagging instead of deleting.
//
// Usage (once wired into a component in a later phase):
//   import { featureFlags } from '@/lib/featureFlags';
//   if (featureFlags.payments) { ... }
//
// Flags read from Vite env vars so they can differ per environment
// (e.g. turn payments on in staging before production) without a code change.

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

const flag = (envVar, fallback = false) => {
  const raw = viteEnv[envVar];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === true;
};

export const featureFlags = {
  // Required V1 capabilities that remain OFF only while their Base44-backed
  // implementations are being replaced. A launch build is not acceptable
  // until these are implemented, verified, and explicitly enabled.
  businessProfiles: flag('VITE_FEATURE_BUSINESS_PROFILES', true),
  messaging: flag('VITE_FEATURE_MESSAGING'),
  essentialNotifications: flag('VITE_FEATURE_ESSENTIAL_NOTIFICATIONS'),

  // Tours remains explicitly enabled per environment after backend, seller,
  // listing integration and public-catalogue acceptance. toursPreview exposes
  // only the controlled placeholder while the public flag remains closed.
  tours: flag('VITE_FEATURE_TOURS'),
  toursPreview: flag('VITE_FEATURE_TOURS_PREVIEW', Boolean(viteEnv.DEV)),
  maps: flag('VITE_FEATURE_MAPS'),
  googleOAuth: flag('VITE_FEATURE_GOOGLE_OAUTH', flag('VITE_AUTH_GOOGLE_ENABLED')),
  phoneVerification: flag('VITE_FEATURE_PHONE_VERIFICATION'),
  currencyConversion: flag('VITE_FEATURE_CURRENCY_CONVERSION'),
  internationalListing: flag('VITE_FEATURE_INTERNATIONAL_LISTING', true),
  manualLocation: flag('VITE_FEATURE_MANUAL_LOCATION', true),
  currentLocation: flag('VITE_FEATURE_CURRENT_LOCATION', true),
  serviceRadius: flag('VITE_FEATURE_SERVICE_RADIUS'),
  listingExpiry: flag('VITE_FEATURE_LISTING_EXPIRY'),
  listingFreshnessReminders: flag('VITE_FEATURE_LISTING_FRESHNESS_REMINDERS'),
  reporting: flag('VITE_FEATURE_REPORTING', true),

  // Payment-related — OFF for MVP. Re-enabling requires wiring a real
  // gateway (Stripe + Ecocash/InnBucks reconciliation) in addition to
  // flipping this flag; the flag alone won't make payments functional.
  payments: flag('VITE_FEATURE_PAYMENTS'),
  subscriptions: flag('VITE_FEATURE_SUBSCRIPTIONS'),
  escrow: flag('VITE_FEATURE_ESCROW'),
  premiumListings: flag('VITE_FEATURE_PREMIUM_LISTINGS'),

  // AI-related — OFF by default. Architecture (tables, queues) stays intact
  // so turning these back on doesn't require another migration.
  aiContentModeration: flag('VITE_FEATURE_AI_MODERATION'),
  aiBanEvasionDetection: flag('VITE_FEATURE_AI_BAN_EVASION'),
  aiTicketTriage: flag('VITE_FEATURE_AI_TICKET_TRIAGE'), // falls back to rule-based triage when off
  aiSupportChat: flag('VITE_FEATURE_AI_SUPPORT_CHAT'),

  // Automation that's deferred, not removed
  scheduledReminders: flag('VITE_FEATURE_SCHEDULED_REMINDERS'),
  marketingEmails: flag('VITE_FEATURE_MARKETING_EMAILS'),
};
