import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Pins the wiring of opt-in TOTP two-step verification:
//   * every MFA call goes through authService (the single supabase.auth boundary),
//   * the app-level gate challenges an aal1 session that holds a verified factor,
//     covering every sign-in path, and never releases the app on a stale read,
//   * enrollment/removal live in Settings,
//   * the local stack has TOTP enabled so the flow is exercisable.
// These are text assertions; the behavioural suite (tests/behaviour/mfa*.test.*)
// exercises the runtime behaviour.

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [authService, app, challenge, mfaSettings, settingsPage, config] = await Promise.all([
  read('src/services/authService.js'),
  read('src/App.jsx'),
  read('src/components/auth/MfaChallengeScreen.jsx'),
  read('src/components/settings/MfaSettings.jsx'),
  read('src/pages/Settings.jsx'),
  read('supabase/config.toml'),
]);

test('authService owns the MFA calls, keeping the supabase.auth boundary intact', () => {
  for (const name of [
    'getAuthenticatorAssuranceLevel',
    'mfaChallengeRequired',
    'listVerifiedTotpFactors',
    'enrollTotpFactor',
    'verifyTotpCode',
    'unenrollMfaFactor',
  ]) {
    assert.match(authService, new RegExp(`export async function ${name}\\b`), `authService must export ${name}`);
  }
  assert.match(authService, /supabase\.auth\.mfa\.enroll\(/);
  assert.match(authService, /supabase\.auth\.mfa\.challengeAndVerify\(/);
  assert.match(authService, /supabase\.auth\.mfa\.listFactors\(/);
  assert.match(authService, /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(/);
  assert.match(authService, /supabase\.auth\.mfa\.unenroll\(/);
});

test('the challenge decision fails safe: an aal1 session confirms against a fresh factor list', () => {
  // The fallback path must not trust a possibly-stale nextLevel -- it re-reads
  // the verified factors before deciding "no challenge".
  const body = authService.match(/export async function mfaChallengeRequired\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(body, 'mfaChallengeRequired must be present');
  assert.match(body, /currentLevel !== 'aal1'/);
  assert.match(body, /listVerifiedTotpFactors\(\)/, 'the aal1 fallback must consult a fresh factor list');
});

test('the app-level gate challenges before rendering routes and covers every sign-in path', () => {
  assert.match(app, /import MfaChallengeScreen from '@\/components\/auth\/MfaChallengeScreen'/);
  assert.match(app, /authService\.mfaChallengeRequired\(\)/);
  assert.match(app, /<MfaChallengeScreen\s+onVerified=/);
  // The gate keys off the session assurance level (not a single page), and it
  // fails closed: on 'error' it renders a retry state, never the app.
  assert.match(app, /mfaGate\.status === 'required'/);
  assert.match(app, /mfaGate\.status === 'error'/);
  // Password recovery stays reachable without a second factor.
  assert.match(app, /reset-password/);
});

test('the challenge screen and settings go through authService, never the raw client', () => {
  for (const [label, source] of [['MfaChallengeScreen', challenge], ['MfaSettings', mfaSettings]]) {
    assert.match(source, /from '@\/services\/authService'/, `${label} must use authService`);
    assert.doesNotMatch(source, /@\/lib\/supabaseClient/, `${label} must not import the supabase client directly`);
  }
  assert.match(challenge, /authService\.verifyTotpCode\(/);
  assert.match(challenge, /authService\.listVerifiedTotpFactors\(/);
  assert.match(mfaSettings, /authService\.enrollTotpFactor\(/);
  assert.match(mfaSettings, /authService\.verifyTotpCode\(/);
  assert.match(mfaSettings, /authService\.unenrollMfaFactor\(/);
});

test('Settings renders the two-step verification section', () => {
  assert.match(settingsPage, /import MfaSettings from ['"]@\/components\/settings\/MfaSettings['"]/);
  assert.match(settingsPage, /<MfaSettings\s*\/>/);
});

test('the local stack enables TOTP so enrollment and challenge are exercisable', () => {
  assert.match(
    config,
    /\[auth\.mfa\.totp\][\s\S]*?enroll_enabled\s*=\s*true[\s\S]*?verify_enabled\s*=\s*true/,
    '[auth.mfa.totp] must have enroll_enabled and verify_enabled = true',
  );
});
