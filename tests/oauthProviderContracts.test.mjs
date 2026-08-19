import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const [providerSource, featureFlagSource, stagingPolicySource, authSource, loginSource, registerSource, topNavSource] =
  await Promise.all([
    readFile(new URL('../src/lib/oauthProviders.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/featureFlags.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/stagingCapabilityPolicy.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/authService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Register.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/layout/TopNav.jsx', import.meta.url), 'utf8'),
  ]);

test('OAuth providers default off and use centralized explicit browser flags', () => {
  assert.match(providerSource, /google: featureFlags\.googleOAuth/);
  assert.match(providerSource, /apple: enabled\(import\.meta\.env\.VITE_AUTH_APPLE_ENABLED\)/);
  assert.match(providerSource, /=== 'true'/);
  assert.match(
    featureFlagSource,
    /googleOAuth:\s*stagingProviderFlag\(\s*'VITE_FEATURE_GOOGLE_OAUTH',\s*'VITE_AUTH_GOOGLE_ENABLED',?\s*\)/,
  );
  assert.match(stagingPolicySource, /export function resolveStagingProviderFlag/);
  assert.match(stagingPolicySource, /isTrustedStagingEnvironment\(env\)/);
  assert.doesNotMatch(providerSource, /import\.meta\??\.env\??\.\?\[name\]/);
});

test('disabled or unsupported providers cannot reach Supabase Auth', () => {
  assert.match(authSource, /\['google', 'apple'\]\.includes\(provider\)/);
  assert.match(authSource, /isOAuthProviderEnabled\(provider\)/);
  assert.match(authSource, /signInWithOAuth\(\{/);
  assert.match(authSource, /buildOAuthCallbackUrl\(bridgeId, redirectPath\)/);
  assert.match(authSource, /buildFullWindowOAuthCallbackUrl\(redirectPath\)/);
  assert.match(authSource, /queryParams:\s*provider === 'google' \? \{ prompt: 'select_account' \} : undefined/);
  assert.match(authSource, /skipBrowserRedirect:\s*true/);
  assert.match(authSource, /setOAuthSessionFromPayload\(message\.session\)/);
});

test('desktop OAuth popup keeps the opener bridge reachable', () => {
  assert.match(authSource, /popup=yes,width=520,height=720,resizable=yes,scrollbars=yes/);
  assert.doesNotMatch(authSource, /popup=yes,width=520,height=720[^']*noopener/);
});

test('Login and Register hide unavailable OAuth providers', () => {
  for (const source of [loginSource, registerSource]) {
    assert.match(source, /oauthProviders\.google &&/);
    assert.match(source, /oauthProviders\.apple &&/);
    assert.match(source, /hasEnabledOAuthProvider &&/);
  }
});

test('generic desktop sign-in returns to the current screen after OAuth', () => {
  assert.match(topNavSource, /const currentPath = `\$\{location\.pathname\}\$\{location\.search\}\$\{location\.hash\}`/);
  assert.match(topNavSource, /createLoginPath\(currentPath\)/);
  assert.doesNotMatch(topNavSource, /createLoginPath\('\/profile'\)/);
});

test('environment validation rejects malformed OAuth availability flags', () => {
  const result = spawnSync(process.execPath, ['./scripts/validate-env.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_MODE: 'development',
      VITE_SUPABASE_URL: 'https://findit-oauth-contract.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_oauth_contract_only',
      VITE_AUTH_GOOGLE_ENABLED: 'yes',
      VITE_AUTH_APPLE_ENABLED: 'false',
    },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VITE_AUTH_GOOGLE_ENABLED must be exactly true or false/);
});
