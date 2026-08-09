// src/services/authService.js
//
// Phase 2A–2C. Replaces: base44.auth.* (session/login/logout in 2A;
// register/reset/email-verification in 2B; route-role verification in 2C).
//
// Per MIGRATION.md principle #3 ("the frontend never talks to Supabase
// directly"), this is the ONLY file besides src/lib/supabaseClient.js that
// imports supabase.auth. AuthContext consumes this module, not the SDK.

import { supabase } from '@/lib/supabaseClient';
import { isOAuthProviderEnabled } from '@/lib/oauthProviders';
import { sanitizeReturnTo } from '@/lib/authNavigation';

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

const passwordRecoveryMarkerKey = 'peekalisting.password-recovery-user';
let passwordRecoveryUserId = null;

function configuredAppOrigin() {
  const configuredOrigin = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN ?? '').trim();
  if (!configuredOrigin) return window.location.origin;

  try {
    const parsedOrigin = new URL(configuredOrigin);
    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) return window.location.origin;
    return parsedOrigin.origin;
  } catch {
    return window.location.origin;
  }
}

export function appUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = new URL(import.meta.env.BASE_URL, configuredAppOrigin());
  return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

function withAuthFailure(error, finditAuthFailure) {
  return Object.assign(new Error(error.message), { cause: error, finditAuthFailure });
}

const OAUTH_CALLBACK_PATH = '/auth/callback';
const OAUTH_BRIDGE_SOURCE = 'peekalisting-oauth';
const OAUTH_BRIDGE_TIMEOUT_MS = 3 * 60 * 1000;

function createOAuthBridgeId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(4);
      window.crypto.getRandomValues(values);
      return Array.from(values, (value) => value.toString(36)).join('-');
    }
  } catch {
    // The non-cryptographic fallback is only a tab correlation ID, not a secret.
  }
  return `oauth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function oauthBridgeChannelName(bridgeId) {
  return `${OAUTH_BRIDGE_SOURCE}:${bridgeId}`;
}

function buildOAuthCallbackUrl(bridgeId, returnTo) {
  const callbackUrl = new URL(appUrl(OAUTH_CALLBACK_PATH));
  callbackUrl.searchParams.set('bridge', bridgeId);
  callbackUrl.searchParams.set('returnTo', sanitizeReturnTo(returnTo, '/'));
  return callbackUrl.toString();
}

function buildFullWindowOAuthCallbackUrl(returnTo) {
  const callbackUrl = new URL(appUrl(OAUTH_CALLBACK_PATH));
  callbackUrl.searchParams.set('returnTo', sanitizeReturnTo(returnTo, '/'));
  return callbackUrl.toString();
}

function readOAuthCallbackError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const providerError = hash.get('error') || query.get('error');
  const description = hash.get('error_description') || query.get('error_description');
  if (!providerError && !description) return '';
  return providerError === 'access_denied'
    ? 'Google sign-in was cancelled.'
    : 'Google sign-in was not completed. Please try again.';
}

function validOAuthSessionPayload(session) {
  return Boolean(
    session
      && typeof session.access_token === 'string'
      && session.access_token
      && typeof session.refresh_token === 'string'
      && session.refresh_token,
  );
}

async function setOAuthSessionFromPayload(session) {
  if (!validOAuthSessionPayload(session)) throw new Error('The sign-in provider returned an incomplete session.');
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
  return data;
}

export function postOAuthBridgeMessage(message) {
  const bridgeId = String(message?.bridgeId || '').trim();
  if (!bridgeId) return false;
  const payload = { ...message, bridgeId, source: OAUTH_BRIDGE_SOURCE };
  let delivered = false;

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      delivered = true;
    }
  } catch {
    // BroadcastChannel below is the fallback for PWA/browser context splits.
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(oauthBridgeChannelName(bridgeId));
      channel.postMessage(payload);
      window.setTimeout(() => channel.close(), 250);
      delivered = true;
    }
  } catch {
    // Older embedded browsers may not implement BroadcastChannel.
  }

  return delivered;
}

function waitForOAuthBridge(bridgeId, popup) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let processing = false;
    let closeTimer;
    let timeoutTimer;
    let channel;

    const cleanup = () => {
      window.removeEventListener('message', onWindowMessage);
      if (closeTimer) window.clearInterval(closeTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      channel?.close();
    };

    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      cleanup();
      callback(value);
    };

    const fail = (error) => finish(reject, error instanceof Error ? error : new Error(String(error)));

    const handleMessage = (message, origin = '') => {
      if (origin && origin !== window.location.origin) return;
      if (!message || message.source !== OAUTH_BRIDGE_SOURCE || message.bridgeId !== bridgeId) return;
      if (processing || finished) return;
      if (message.type === 'error') {
        fail(new Error(message.error || 'Sign-in was not completed.'));
        return;
      }
      if (message.type !== 'session' || !validOAuthSessionPayload(message.session)) {
        fail(new Error('The sign-in provider returned an incomplete session.'));
        return;
      }
      processing = true;
      setOAuthSessionFromPayload(message.session)
        .then((data) => finish(resolve, data))
        .catch((error) => fail(error));
    };

    const onWindowMessage = (event) => handleMessage(event.data, event.origin);
    window.addEventListener('message', onWindowMessage);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(oauthBridgeChannelName(bridgeId));
        channel.addEventListener('message', (event) => handleMessage(event.data));
      }
    } catch {
      channel = undefined;
    }

    closeTimer = window.setInterval(() => {
      if (popup.closed) fail(new Error('The sign-in window was closed before sign-in completed.'));
    }, 500);
    timeoutTimer = window.setTimeout(() => fail(new Error('Sign-in took too long. Please try again.')), OAUTH_BRIDGE_TIMEOUT_MS);
  });
}

export async function completeOAuthCallback({ bridgeId = '', returnTo = '/' } = {}) {
  const callbackError = readOAuthCallbackError();
  if (callbackError) {
    if (bridgeId) postOAuthBridgeMessage({ type: 'error', bridgeId, error: callbackError });
    throw new Error(callbackError);
  }

  try {
    const session = await getSession();
    if (!session) throw new Error('Google sign-in did not return a session.');
    if (bridgeId) {
      const bridged = postOAuthBridgeMessage({
        type: 'session',
        bridgeId,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
      });
      return { session, bridged };
    }
    return { session, bridged: false, returnTo: sanitizeReturnTo(returnTo, '/') };
  } catch (error) {
    if (bridgeId) postOAuthBridgeMessage({ type: 'error', bridgeId, error: 'Google sign-in could not be completed.' });
    throw error;
  }
}

function readPasswordRecoveryMarker() {
  try { return window.sessionStorage.getItem(passwordRecoveryMarkerKey); } catch { return null; }
}
function writePasswordRecoveryMarker(userId) {
  passwordRecoveryUserId = userId;
  try { window.sessionStorage.setItem(passwordRecoveryMarkerKey, userId); } catch { /* memory marker remains */ }
}
function clearPasswordRecoveryMarker() {
  passwordRecoveryUserId = null;
  try { window.sessionStorage.removeItem(passwordRecoveryMarkerKey); } catch { /* nothing else required */ }
}
passwordRecoveryUserId = readPasswordRecoveryMarker();

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session?.user?.id) writePasswordRecoveryMarker(session.user.id);
  else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') clearPasswordRecoveryMarker();
});

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function changePassword(currentPassword, newPassword) {
  const session = await getSession();
  const email = session?.user?.email;
  if (!email) throw new Error('You must be signed in to change your password.');
  const { error: verificationError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verificationError) throw new Error('Your current password is incorrect.');
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function signInWithOAuth(provider, redirectPath = '/') {
  if (!['google', 'apple'].includes(provider)) throw new Error('Unsupported sign-in provider.');
  if (!isOAuthProviderEnabled(provider)) throw new Error(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not available.`);
  const bridgeId = createOAuthBridgeId();
  let popup;

  // Open the window before the Supabase request so popup blockers still allow
  // the provider flow when this function is called from a sign-in button.
  try {
    popup = window.open('about:blank', 'peekalisting-oauth', 'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes');
  } catch {
    popup = null;
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: popup && !popup.closed
          ? buildOAuthCallbackUrl(bridgeId, redirectPath)
          : buildFullWindowOAuthCallbackUrl(redirectPath),
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('The sign-in provider did not return a redirect URL.');

    if (!popup || popup.closed) {
      // Full-window fallback keeps sign-in usable when the browser blocks a
      // popup or an installed PWA does not expose a separate window handle.
      window.location.assign(data.url);
      return undefined;
    }

    // Install the bridge listener before navigating the popup so a very fast
    // provider callback cannot race the parent listener.
    const bridge = waitForOAuthBridge(bridgeId, popup);
    popup.location.assign(data.url);
    popup.focus?.();
    return await bridge;
  } catch (error) {
    try { popup?.close(); } catch { /* popup may already be gone */ }
    throw error;
  }
}

export async function signOut(redirectUrl) {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
  if (redirectUrl) window.location.href = appUrl(redirectUrl);
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function hasRequiredRole(requiredRole) {
  if (requiredRole === 'user') return Boolean(await getSession());
  const rpcName = { admin: 'is_admin', super_admin: 'is_super_admin' }[requiredRole];
  if (!rpcName) throw new Error(`Unsupported required role: ${requiredRole}`);
  const { data, error } = await supabase.rpc(rpcName);
  if (error) throw error;
  return data === true;
}

export async function getCurrentUser() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw withAuthFailure(sessionError, 'auth_unavailable');
  if (!session?.user) return null;
  const { data: profile, error: profileError } = await supabase.from('users').select(AUTH_PROFILE_SELECT).eq('id', session.user.id).single();
  if (profileError) throw withAuthFailure(profileError, profileError.code === 'PGRST116' ? 'profile_missing' : 'auth_unavailable');
  return profile;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

export async function signUp({ email, password, phone, firstName = '', lastName = '', redirectPath = '/' }) {
  const normalizedFirstName = String(firstName || '').trim();
  const normalizedLastName = String(lastName || '').trim();
  const fullName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone,
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        full_name: fullName,
      },
      emailRedirectTo: appUrl(redirectPath),
    },
  });
  if (error) throw error;
  return data;
}

export async function resendSignupConfirmation(email, redirectPath = '/') {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl(redirectPath) } });
  if (error) throw error;
}

export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('/reset-password') });
  if (error) throw error;
}

export async function hasPasswordRecoverySession() {
  const session = await getSession();
  const recoveryUserId = passwordRecoveryUserId || readPasswordRecoveryMarker();
  return Boolean(session?.user?.id && recoveryUserId === session.user.id);
}

export async function updatePassword(newPassword) {
  if (!(await hasPasswordRecoverySession())) throw new Error('A valid password recovery link is required.');
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  clearPasswordRecoveryMarker();
  return data;
}

export async function getAuthenticatorAssuranceLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

export async function mfaChallengeRequired() {
  const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
  if (currentLevel !== 'aal1') return false;
  if (nextLevel === 'aal2') return true;
  const verified = await listVerifiedTotpFactors();
  return verified.length > 0;
}

export async function listVerifiedTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data?.totp ?? [];
}

export async function enrollTotpFactor(friendlyName = 'PeekaListing authenticator') {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const stale = (factors?.all ?? []).filter((factor) => factor.status !== 'verified');
  for (const factor of stale) await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {});
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? '',
    secret: data.totp?.secret ?? '',
    uri: data.totp?.uri ?? '',
  };
}

export async function verifyTotpCode(factorId, code) {
  if (!factorId || !/^\d{6}$/.test(code)) throw new Error('Enter a valid 6-digit authentication code.');
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  return data;
}

export async function unenrollMfaFactor(factorId) {
  if (!factorId) throw new Error('A factor ID is required.');
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
