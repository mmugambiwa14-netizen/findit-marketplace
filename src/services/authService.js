// src/services/authService.js
//
// Phase 2A–2C. Replaces: base44.auth.* (session/login/logout in 2A;
// register/reset/email-verification in 2B; route-role verification in 2C).
//
// Per MIGRATION.md principle #3 ("the frontend never talks to Supabase
// directly"), this is the ONLY file besides src/lib/supabaseClient.js that
// imports supabase.auth. AuthContext consumes this module, not the SDK.

import { supabase } from '@/lib/supabaseClient';

const AUTH_PROFILE_SELECT = `
  id,
  email,
  full_name,
  role,
  phone,
  phone_verified,
  bio,
  avatar_url,
  status,
  ban_reason,
  ban_until,
  created_at,
  updated_at
`;
import { isOAuthProviderEnabled } from '@/lib/oauthProviders';

// Supabase emits PASSWORD_RECOVERY only after it has accepted a real recovery
// link. Remember that event for this browser tab so ResetPassword can safely
// handle the case where the event arrives before its React effect subscribes.
// Never infer recovery from an ordinary authenticated session or from URL text.
const passwordRecoveryMarkerKey = 'findit.password-recovery-user';
let passwordRecoveryUserId = null;

export function appUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

function withAuthFailure(error, finditAuthFailure) {
  return Object.assign(new Error(error.message), {
    cause: error,
    finditAuthFailure,
  });
}

function readPasswordRecoveryMarker() {
  try {
    return window.sessionStorage.getItem(passwordRecoveryMarkerKey);
  } catch {
    return null;
  }
}

function writePasswordRecoveryMarker(userId) {
  passwordRecoveryUserId = userId;
  try {
    window.sessionStorage.setItem(passwordRecoveryMarkerKey, userId);
  } catch {
    // The in-memory marker is sufficient when sessionStorage is unavailable.
  }
}

function clearPasswordRecoveryMarker() {
  passwordRecoveryUserId = null;
  try {
    window.sessionStorage.removeItem(passwordRecoveryMarkerKey);
  } catch {
    // Nothing else is required when sessionStorage is unavailable.
  }
}

passwordRecoveryUserId = readPasswordRecoveryMarker();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session?.user?.id) {
    writePasswordRecoveryMarker(session.user.id);
  } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    // A normal sign-in must not inherit a recovery authorisation, even for the
    // same user in the same browser tab.
    clearPasswordRecoveryMarker();
  }
});

/**
 * Email/password sign in. Mirrors base44.auth.loginViaEmailPassword().
 * Throws on failure with a `.message` the UI can show directly.
 */
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Re-authenticates the current email/password user before changing their
 * password. The V1 Settings screen requires the existing password rather than
 * presenting a success toast for a change that never reached the provider.
 */
export async function changePassword(currentPassword, newPassword) {
  const session = await getSession();
  const email = session?.user?.email;
  if (!email) throw new Error('You must be signed in to change your password.');

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verificationError) throw new Error('Your current password is incorrect.');

  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

/**
 * OAuth sign in. Mirrors base44.auth.loginWithProvider(provider, redirectPath).
 * Supabase handles the redirect itself via `redirectTo`, so this navigates
 * away from the page — nothing meaningful to return.
 *
 * NOTE (see docs/AUTH_MIGRATION_PLAN.md §4): confirm both 'google' and
 * 'apple' are configured as providers in the Supabase dashboard before
 * relying on this in production — an unconfigured provider fails at
 * Supabase's redirect step, not here.
 */
export async function signInWithOAuth(provider, redirectPath = '/') {
  if (!['google', 'apple'].includes(provider)) {
    throw new Error('Unsupported sign-in provider.');
  }
  if (!isOAuthProviderEnabled(provider)) {
    throw new Error(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not available.`);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: appUrl(redirectPath) },
  });
  if (error) throw error;
}

/**
 * Mirrors base44.auth.logout(redirectUrl?). Always clears the local session;
 * only navigates if a redirect target is given, matching the old two-call
 * shape (`logout(url)` vs `logout()`).
 */
export async function signOut(redirectUrl) {
  // Global scope revokes every refresh token for the user, not just this
  // browser's. supabase-js already defaults to 'global'; stating it here means
  // a future default change cannot silently downgrade logout to one device.
  // Note this does NOT invalidate access tokens already issued -- those are
  // stateless JWTs and stay valid until `jwt_expiry` elapses.
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
  if (redirectUrl) {
    window.location.href = appUrl(redirectUrl);
  }
}

/** Raw Supabase session (JWT + expiry), or null if signed out. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Checks a role with the current Supabase session at the database boundary.
 * The RPCs are SECURITY DEFINER functions whose result is derived from the
 * current auth.uid(), rather than from a client-cached profile object.
 */
export async function hasRequiredRole(requiredRole) {
  if (requiredRole === 'user') {
    return Boolean(await getSession());
  }

  const rpcName = {
    admin: 'is_admin',
    super_admin: 'is_super_admin',
  }[requiredRole];

  if (!rpcName) {
    throw new Error(`Unsupported required role: ${requiredRole}`);
  }

  const { data, error } = await supabase.rpc(rpcName);
  if (error) throw error;
  return data === true;
}

/**
 * Mirrors base44.auth.me(). Fetches the Supabase auth session, then joins
 * the public.users profile row (role, status, ban_*, phone_verified, etc.)
 * for that same id — this is the one function that must return everything
 * AccountBlocked / ProtectedRoute / AuthContext expect, so nothing regresses
 * silently. Returns null for a guest (never throws for "not logged in").
 */
export async function getCurrentUser() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw withAuthFailure(sessionError, 'auth_unavailable');
  }
  if (!session?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select(AUTH_PROFILE_SELECT)
    .eq('id', session.user.id)
    .single();

  if (profileError) {
    // A missing profile row for a valid auth session is a data-integrity
    // problem, not "guest" — surface it rather than silently degrading to
    // logged-out, so it isn't mistaken for an expected state.
    throw withAuthFailure(
      profileError,
      profileError.code === 'PGRST116' ? 'profile_missing' : 'auth_unavailable',
    );
  }

  return profile;
}

/**
 * Subscribe to auth state changes (sign in, sign out, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// ---------------------------------------------------------------------------
// Phase 2B — registration, password reset, email verification
// ---------------------------------------------------------------------------

/**
 * Mirrors base44.auth.register({ email, password }) — but per the decision
 * in docs/AUTH_MIGRATION_PLAN.md §5, verification is now Supabase's standard
 * link-in-email flow, not a custom OTP screen.
 *
 * `phone` is passed as auth user_metadata; migration 0012 extends the
 * existing handle_new_auth_user() trigger to copy it into public.users.phone
 * when the row is created, alongside the full_name the trigger already
 * copies. phone_verified is untouched here — that's the separate
 * RequirePhoneVerification OTP flow, out of scope for this phase.
 *
 * `emailRedirectTo` is where Supabase sends the user after they click the
 * confirmation link; the session is established automatically on arrival
 * because supabaseClient.js has `detectSessionInUrl: true`.
 */
export async function signUp({ email, password, phone, redirectPath = '/' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { phone },
      emailRedirectTo: appUrl(redirectPath),
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Re-sends the signup confirmation email. Mirrors base44.auth.resendOtp(),
 * adapted to Supabase's link-based flow (there's no code to resend, only
 * the email itself).
 */
export async function resendSignupConfirmation(email, redirectPath = '/') {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: appUrl(redirectPath) },
  });
  if (error) throw error;
}

/**
 * Mirrors base44.auth.resetPasswordRequest(email). Always resolves without
 * revealing whether the address has an account — ForgotPassword.jsx already
 * shows a generic "if an account exists..." message regardless of outcome,
 * matching the enumeration-safe pattern from the Base44 version.
 */
export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/reset-password'),
  });
  if (error) throw error;
}

/**
 * True only for the browser-tab session created by a verified Supabase
 * password-recovery callback. A normal signed-in session is deliberately not
 * sufficient to enter the recovery flow.
 */
export async function hasPasswordRecoverySession() {
  const session = await getSession();
  const recoveryUserId = passwordRecoveryUserId || readPasswordRecoveryMarker();
  return Boolean(session?.user?.id && recoveryUserId === session.user.id);
}

/**
 * Mirrors base44.auth.resetPassword({ resetToken, newPassword }). Supabase
 * has no separate reset-token parameter — clicking the emailed link (via
 * `detectSessionInUrl`) already establishes a temporary recovery session,
 * and this just updates the password on it.
 */
export async function updatePassword(newPassword) {
  if (!(await hasPasswordRecoverySession())) {
    throw new Error('A valid password recovery link is required.');
  }

  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  clearPasswordRecoveryMarker();
  return data;
}

// ---------------------------------------------------------------------------
// Multi-factor authentication (authenticator app / TOTP)
// ---------------------------------------------------------------------------
//
// FindIt offers opt-in TOTP MFA. Enrollment lives in Settings; once a user
// holds a verified factor, every subsequent sign-in -- password OR OAuth --
// must clear an assurance step-up before the app renders. That gate is enforced
// globally in AuthenticatedApp via mfaChallengeRequired(), so it does not matter
// which page performed the sign-in. All of these calls stay in this module so
// authService remains the single supabase.auth boundary.
//
// Whether TOTP can be enrolled/verified at all is a backend switch
// ([auth.mfa.totp] locally; Authentication -> MFA on the hosted project). With
// it off, enroll() rejects and the UI surfaces that; the challenge gate simply
// never triggers because no one can hold a verified factor.

/**
 * Assurance level of the current session. `nextLevel` only rises to 'aal2'
 * when the user has a verified factor, so a pending step-up is exactly
 * currentLevel 'aal1' while nextLevel is 'aal2'. Returns null levels for a
 * guest.
 */
export async function getAuthenticatorAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

/**
 * True when the signed-in user holds a verified factor but this session has not
 * yet cleared the MFA challenge. Guests and users without a factor return
 * false. Errors are rethrown, never swallowed as `false`, so the gate that
 * consumes this fails safe (shows an error state) rather than skipping MFA.
 */
export async function mfaChallengeRequired() {
  const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
  // Already stepped up, or a guest (null levels): nothing to challenge.
  if (currentLevel !== 'aal1') return false;
  // Fast path: the session already reports a second factor exists.
  if (nextLevel === 'aal2') return true;
  // Otherwise confirm against a fresh factor list rather than trusting a
  // possibly-stale `user.factors` on the session. Never skip MFA on stale data.
  const verified = await listVerifiedTotpFactors();
  return verified.length > 0;
}

/** Verified TOTP factors for the current user. supabase-js already filters
 *  `data.totp` to verified factors; unverified ones live only in `data.all`. */
export async function listVerifiedTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data?.totp ?? [];
}

/**
 * Begin TOTP enrollment. Returns the QR code (an SVG the browser can render),
 * the shared secret and the otpauth URI so the UI can offer a scan with a
 * manual-entry fallback. Any lingering *unverified* factor is cleared first so
 * a retried enrollment neither collides on the unique friendly name nor leaves
 * dead half-enrolled factors behind.
 */
export async function enrollTotpFactor(friendlyName = 'FindIt authenticator') {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const stale = (factors?.all ?? []).filter((factor) => factor.status !== 'verified');
  for (const factor of stale) {
    // Best-effort cleanup; a failure here should not block a fresh enrollment.
    await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? '',
    secret: data.totp?.secret ?? '',
    uri: data.totp?.uri ?? '',
  };
}

/**
 * Verify a 6-digit code against a factor. Used both to confirm a freshly
 * enrolled factor and to clear the sign-in step-up. `challengeAndVerify` issues
 * a fresh challenge and verifies it in one round trip; on success the session
 * is elevated to aal2.
 */
export async function verifyTotpCode(factorId, code) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  return data;
}

/** Remove a TOTP factor. Once the last one is gone the user drops to aal1. */
export async function unenrollMfaFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
