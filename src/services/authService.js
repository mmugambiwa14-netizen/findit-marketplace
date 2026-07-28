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
  const { error } = await supabase.auth.signOut();
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
