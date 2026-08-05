import { describe, expect, test, vi, beforeEach } from 'vitest';

// The MFA gate decision lives in authService.mfaChallengeRequired(). It is the
// security-critical branch: if it ever returns false when a verified factor
// exists on an aal1 session, a password-only attacker walks straight past MFA.
// These tests pin that decision, and the enrollment cleanup, against a mocked
// supabase.auth.mfa boundary.

const mfa = {
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      mfa,
      // authService subscribes at module load; the return value is unused there.
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

const authService = await import('@/services/authService');

const aal = (currentLevel, nextLevel) => ({ data: { currentLevel, nextLevel }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mfaChallengeRequired', () => {
  test('a guest (no session, null levels) is never challenged', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal(null, null));
    expect(await authService.mfaChallengeRequired()).toBe(false);
    expect(mfa.listFactors).not.toHaveBeenCalled();
  });

  test('a session already at aal2 is not challenged again', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal2', 'aal2'));
    expect(await authService.mfaChallengeRequired()).toBe(false);
    expect(mfa.listFactors).not.toHaveBeenCalled();
  });

  test('aal1 with nextLevel aal2 is challenged on the fast path, without a factor lookup', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1', 'aal2'));
    expect(await authService.mfaChallengeRequired()).toBe(true);
    expect(mfa.listFactors).not.toHaveBeenCalled();
  });

  test('aal1 with a stale nextLevel still challenges when a verified factor exists', async () => {
    // The session reports nextLevel aal1 (stale user.factors), but a fresh
    // factor list shows a verified TOTP factor -- MFA must NOT be skipped.
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1', 'aal1'));
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1', status: 'verified' }], all: [] }, error: null });
    expect(await authService.mfaChallengeRequired()).toBe(true);
    expect(mfa.listFactors).toHaveBeenCalledTimes(1);
  });

  test('aal1 with no verified factor is not challenged', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(aal('aal1', 'aal1'));
    mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    expect(await authService.mfaChallengeRequired()).toBe(false);
  });

  test('an error from the provider rejects rather than resolving false', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new Error('network') });
    await expect(authService.mfaChallengeRequired()).rejects.toThrow('network');
  });
});

describe('enrollTotpFactor', () => {
  test('clears lingering unverified factors, then returns the normalised enrollment', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { all: [{ id: 'stale', status: 'unverified' }, { id: 'keep', status: 'verified' }], totp: [] },
      error: null,
    });
    mfa.unenroll.mockResolvedValue({ data: {}, error: null });
    mfa.enroll.mockResolvedValue({
      data: { id: 'new', totp: { qr_code: '<svg/>', secret: 'ABCD', uri: 'otpauth://x' } },
      error: null,
    });

    const result = await authService.enrollTotpFactor('FindIt authenticator');

    // Only the unverified factor is cleaned up; the verified one is untouched.
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale' });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'FindIt authenticator' });
    expect(result).toEqual({ factorId: 'new', qrCode: '<svg/>', secret: 'ABCD', uri: 'otpauth://x' });
  });

  test('propagates an enrollment error (e.g. backend has TOTP disabled)', async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    mfa.enroll.mockResolvedValue({ data: null, error: new Error('mfa disabled') });
    await expect(authService.enrollTotpFactor()).rejects.toThrow('mfa disabled');
  });
});

describe('verifyTotpCode / unenrollMfaFactor', () => {
  test('verify issues a single challenge-and-verify round trip', async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: { access_token: 'x' }, error: null });
    await authService.verifyTotpCode('f1', '123456');
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' });
  });

  test('verify surfaces a wrong-code error', async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error('Invalid TOTP code') });
    await expect(authService.verifyTotpCode('f1', '000000')).rejects.toThrow('Invalid TOTP code');
  });

  test('unenroll removes the named factor', async () => {
    mfa.unenroll.mockResolvedValue({ data: {}, error: null });
    await authService.unenrollMfaFactor('f1');
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' });
  });
});
