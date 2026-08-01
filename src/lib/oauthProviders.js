// Vite statically replaces direct import.meta.env references at build time.
// Dynamic access such as import.meta.env[name] is intentionally unsupported.
const enabled = (value) => value === 'true';
const STAGING_BRANCH = 'feature/listing-intelligence-foundation';
const isStagingBranch =
  String(import.meta.env.VITE_VERCEL_GIT_COMMIT_REF ?? '').trim() === STAGING_BRANCH;
const googleFlag = enabled(import.meta.env.VITE_AUTH_GOOGLE_ENABLED);

// Supabase Google OAuth is already configured and callback-tested for the
// staging project. Keep every other deployment explicitly gated by its host
// environment, while allowing the feature branch to show the real provider
// button when Vercel does not inject the optional browser flag.
const googleEnabledForStaging =
  isStagingBranch && import.meta.env.VITE_AUTH_GOOGLE_ENABLED !== 'false';

export const oauthProviders = Object.freeze({
  google: googleFlag || googleEnabledForStaging,
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
