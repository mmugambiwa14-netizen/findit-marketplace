import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authService = await readFile(
  new URL('../src/services/authService.js', import.meta.url),
  'utf8',
);

const existingExports = [
  'appUrl',
  'signInWithPassword',
  'changePassword',
  'signInWithOAuth',
  'signOut',
  'getSession',
  'hasRequiredRole',
  'getCurrentUser',
  'onAuthStateChange',
  'signUp',
  'resendSignupConfirmation',
  'resetPasswordForEmail',
  'hasPasswordRecoverySession',
  'updatePassword',
];

const mfaExports = [
  'getAuthenticatorAssuranceLevel',
  'mfaChallengeRequired',
  'listVerifiedTotpFactors',
  'enrollTotpFactor',
  'verifyTotpCode',
  'unenrollMfaFactor',
];

test('MFA remains append-only at the canonical auth service boundary', () => {
  for (const name of [...existingExports, ...mfaExports]) {
    assert.match(
      authService,
      new RegExp(`export (?:async )?function ${name}\\b`),
      `authService must preserve ${name}`,
    );
  }
});

test('existing authentication safety behavior remains intact', () => {
  assert.match(authService, /signOut\(\{\s*scope:\s*['"]global['"]\s*\}\)/);
  assert.match(authService, /globalSignOutError/);
  assert.match(authService, /if \(globalSignOutError\) await discardInvalidLocalSession\(\)/);
  assert.match(authService, /isOAuthProviderEnabled\(provider\)/);
  assert.match(authService, /profileError\.code === ['"]PGRST116['"]/);
  assert.match(authService, /finditAuthFailure:\s*['"]profile_missing['"]|profile_missing/);
  assert.match(authService, /PASSWORD_RECOVERY/);
  assert.match(authService, /A valid password recovery link is required\./);
  assert.match(authService, /emailRedirectTo:\s*appUrl\(redirectPath\)/);
  assert.match(authService, /redirectTo:\s*appUrl\(['"]\/reset-password['"]\)/);
});

test('MFA verification uses Supabase challenge-and-verify and fresh factor state', () => {
  assert.match(authService, /mfa\.challengeAndVerify\(/);
  assert.match(authService, /mfa\.getAuthenticatorAssuranceLevel\(/);
  assert.match(authService, /mfa\.listFactors\(/);
  assert.match(authService, /listVerifiedTotpFactors\(\)/);
});
