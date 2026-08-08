import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [flags, policy] = await Promise.all([
  readFile(new URL('../src/lib/featureFlags.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/stagingCapabilityPolicy.js', import.meta.url), 'utf8'),
]);

test('Cloudflare preview and staging deployments share the certified capability set', () => {
  assert.match(policy, /export const TRUSTED_NON_PRODUCTION_DEPLOYMENTS/);
  assert.match(policy, /export function isTrustedStagingDeployment/);
  assert.ok(policy.includes("'preview'"), 'Cloudflare preview deployments must be trusted non-production');
  assert.ok(policy.includes("'staging'"), 'the dedicated staging deployment must be trusted non-production');
  assert.ok(policy.includes("'staging.peekalisting.com'"), 'the staging custom domain must remain explicit');
  assert.doesNotMatch(policy, /VERCEL_GIT_COMMIT_REF|\.vercel\.app/);
});

test('staging-certified capabilities cannot be hidden by Preview environment drift', () => {
  assert.match(flags, /const stagingCertifiedFlag = \(envVar\) => resolveStagingCertifiedFlag\(viteEnv, envVar\)/);
  assert.match(
    policy,
    /export function resolveStagingCertifiedFlag[\s\S]*isTrustedStagingEnvironment\(env\) \|\| readBooleanFlag\(env, envVar, false\)/,
  );
  for (const capability of [
    "messaging: stagingCertifiedFlag('VITE_FEATURE_MESSAGING')",
    "essentialNotifications: stagingCertifiedFlag('VITE_FEATURE_ESSENTIAL_NOTIFICATIONS')",
    "tours: stagingCertifiedFlag('VITE_FEATURE_TOURS')",
    "currentLocation: stagingCertifiedFlag('VITE_FEATURE_CURRENT_LOCATION')",
  ]) {
    assert.ok(flags.includes(capability), `${capability} must use staging-certified precedence`);
  }
});

test('unreleased and provider-dependent capabilities remain fail closed', () => {
  assert.match(flags, /maps: flag\('VITE_FEATURE_MAPS', mapProviderConfigured\(\)\)/);
  assert.match(flags, /payments: flag\('VITE_FEATURE_PAYMENTS'\)/);
  assert.match(flags, /aiContentModeration: flag\('VITE_FEATURE_AI_MODERATION'\)/);
});
