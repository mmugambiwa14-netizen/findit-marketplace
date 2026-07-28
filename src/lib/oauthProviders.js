// Vite statically replaces direct import.meta.env references at build time.
// Dynamic access such as import.meta.env[name] is intentionally unsupported.
const enabled = (value) => value === 'true';

export const oauthProviders = Object.freeze({
  google: enabled(import.meta.env.VITE_AUTH_GOOGLE_ENABLED),
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
