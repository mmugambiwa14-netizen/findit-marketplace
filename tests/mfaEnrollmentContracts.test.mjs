import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [authService, app, challenge, mfaSettings, settingsPage] = await Promise.all([
  read('src/services/authService.js'),
  read('src/App.jsx'),
  read('src/components/auth/MfaChallengeScreen.jsx'),
  read('src/components/settings/MfaSettings.jsx'),
  read('src/pages/Settings.jsx'),
]);

test('authService owns the complete MFA boundary', () => {
  for (const name of ['getAuthenticatorAssuranceLevel', 'mfaChallengeRequired', 'listVerifiedTotpFactors', 'enrollTotpFactor', 'verifyTotpCode', 'unenrollMfaFactor']) {
    assert.match(authService, new RegExp(`export async function ${name}\\b`));
  }
  assert.match(authService, /supabase\.auth\.mfa\.enroll\(/);
  assert.match(authService, /supabase\.auth\.mfa\.challengeAndVerify\(/);
  assert.match(authService, /supabase\.auth\.mfa\.listFactors\(/);
  assert.match(authService, /supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(/);
  assert.match(authService, /supabase\.auth\.mfa\.unenroll\(/);
  assert.match(authService, /\^\\d\{6\}\$/);
});

test('the challenge decision confirms a fresh verified-factor list', () => {
  const body = authService.match(/export async function mfaChallengeRequired\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(body, /currentLevel !== 'aal1'/);
  assert.match(body, /listVerifiedTotpFactors\(\)/);
});

test('the app fails closed before rendering authenticated routes', () => {
  assert.match(app, /authService\.mfaChallengeRequired\(\)/);
  assert.match(app, /mfaGate\.status === 'required'/);
  assert.match(app, /mfaGate\.status === 'error'/);
  assert.match(app, /<MfaChallengeScreen onVerified=/);
  assert.match(app, /reset-password/);
});

test('MFA UI uses authService rather than the raw Supabase client', () => {
  for (const source of [challenge, mfaSettings]) {
    assert.match(source, /from '@\/services\/authService'/);
    assert.doesNotMatch(source, /@\/lib\/supabaseClient/);
  }
  assert.match(challenge, /authService\.verifyTotpCode\(/);
  assert.match(mfaSettings, /authService\.enrollTotpFactor\(/);
  assert.match(mfaSettings, /authService\.unenrollMfaFactor\(/);
});

test('Settings exposes account-level MFA enrollment', () => {
  assert.match(settingsPage, /import MfaSettings from ['"]@\/components\/settings\/MfaSettings['"]/);
  assert.match(settingsPage, /<MfaSettings\s*\/>/);
});
