import { featureFlags } from './featureFlags.js';

// OAuth availability is derived from the same deployment capability policy as
// the rest of the application. Keep this module as the provider-facing API so
// auth components do not need to understand branch or environment semantics.
const enabled = (value) => value === 'true';

export const oauthProviders = Object.freeze({
  google: featureFlags.googleOAuth,
  apple: enabled(import.meta.env.VITE_AUTH_APPLE_ENABLED),
});

export function isOAuthProviderEnabled(provider) {
  return provider === 'google'
    ? oauthProviders.google
    : provider === 'apple'
      ? oauthProviders.apple
      : false;
}

export const hasEnabledOAuthProvider =
  oauthProviders.google || oauthProviders.apple;
