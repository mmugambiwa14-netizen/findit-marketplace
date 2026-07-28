import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_ERROR_TYPES, deriveAuthState, toAuthError } from '../src/lib/authState.js';

test('guest state is explicit and has no blocked account', () => {
  assert.deepEqual(deriveAuthState(null), {
    user: null,
    isAuthenticated: false,
    blockedAccount: null,
  });
});

test('active profile is authenticated', () => {
  const user = { id: 'user-1', status: 'active', role: 'user' };
  assert.deepEqual(deriveAuthState(user), {
    user,
    isAuthenticated: true,
    blockedAccount: null,
  });
});

test('suspended and banned profiles are not downgraded to guest state', () => {
  const suspended = deriveAuthState({
    id: 'user-1',
    status: 'suspended',
    ban_reason: 'Policy review',
    ban_until: '2026-07-20T00:00:00.000Z',
  });
  const banned = deriveAuthState({ id: 'user-2', status: 'banned' });

  assert.equal(suspended.isAuthenticated, false);
  assert.deepEqual(suspended.blockedAccount, {
    status: 'suspended',
    reason: 'Policy review',
    banUntil: '2026-07-20T00:00:00.000Z',
  });
  assert.deepEqual(banned.blockedAccount, {
    status: 'banned',
    reason: null,
    banUntil: null,
  });
});

test('missing profile and provider failures have distinct safe error states', () => {
  assert.equal(
    toAuthError({ finditAuthFailure: AUTH_ERROR_TYPES.PROFILE_MISSING }).type,
    AUTH_ERROR_TYPES.PROFILE_MISSING,
  );
  assert.equal(toAuthError(new Error('network unavailable')).type, AUTH_ERROR_TYPES.AUTH_UNAVAILABLE);
});
