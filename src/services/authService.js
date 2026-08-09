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
import { isOptionalProfileSchemaError, isTerminalSessionError } from '@/lib/authState';

const AUTH_PROFILE_SELECT = `
  id,
  email,
  full_name,
  role,
  phone,
  phone_verified,
  bio,
  display_name,
  public_address,
  website_url,
  avatar_url,
  avatar_storage_path,
  status,
  ban_reason,
  ban_until,
  created_at,
  updated_at
`;

// These fields have existed since the original users migration. If a staged
// frontend reaches PostgREST a few seconds before a newly added optional
// seller-profile column is visible, authentication must still complete.
const CORE_AUTH_PROFILE_SELECT = `
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

function persistedAuthStorageKey() {
  try {
    const projectRef = new URL(String(import.meta.env.VITE_SUPABASE_URL || '')).hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : '';
  } catch {
    return '';
  }
}

function removePersistedAuthSession() {
  const storageKey = persistedAuthStorageKey();
  if (!storageKey || typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    const ownedKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (
        key === storageKey
        || key === `${storageKey}-user`
        || key === `${storageKey}-code-verifier`
        || key === `${storageKey}-flows-code-verifier`
        || key.startsWith(`${storageKey}-flow-`)
      )) ownedKeys.push(key);
    }
    ownedKeys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts. The
    // SDK sign-out attempts surrounding this cleanup remain the fallback.
  }
}

async function discardInvalidLocalSession() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (!error) return;
  } catch {
    // A rejected refresh token can prevent the SDK's first sign-out attempt.
  }

  // Remove only this Supabase project's auth entries, then ask the SDK to
  // publish SIGNED_OUT from an empty session. App drafts and preferences stay.
  removePersistedAuthSession();
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* local state is already clear */ }
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

function shouldUseOAuthPopup() {
  try {
    const standalone = Boolean(window.navigator.standalone)
      || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
      || Boolean(window.matchMedia?.('(display-mode: minimal-ui)').matches);
    const touchDevice = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    const narrowViewport = Boolean(window.matchMedia?.('(max-width: 767px)').matches);
    return !standalone && !touchDevice && !narrowViewport;
  } catch {
    return false;
  }
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
  const usePopup = shouldUseOAuthPopup();
  const bridgeId = usePopup ? createOAuthBridgeId() : '';
  let popup;

  // Open the window before the Supabase request so popup blockers still allow
  // the provider flow when this function is called from a sign-in button.
  // Mobile Safari and standalone PWAs use the full-window path below: opening
  // about:blank first can strand a blank child window outside the PWA shell.
  if (usePopup) {
    try {
      popup = window.open(
        'about:blank',
        'peekalisting-oauth',
        'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes,noopener,noreferrer',
      );
    } catch {
      popup = null;
    }
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

async function readUserProfile(userId) {
  const enriched = await supabase.from('users').select(AUTH_PROFILE_SELECT).eq('id', userId).single();
  if (!enriched.error || !isOptionalProfileSchemaError(enriched.error)) return enriched;

  // Optional public seller fields must never become a login dependency. This
  // fallback also covers PostgREST schema-cache propagation during deployment.
  return supabase.from('users').select(CORE_AUTH_PROFILE_SELECT).eq('id', userId).single();
}

function isRefreshableProfileError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || '').toUpperCase();
  return status === 401
    || status === 403
    || ['PGRST301', 'PGRST302', 'JWT_EXPIRED', 'TOKEN_EXPIRED'].includes(code)
    || /jwt|token|expired|session/i.test(String(error?.message || ''));
}

function isTransientProfileError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || '').toUpperCase();
  return status === 0
    || status >= 500
    || ['PGRST000', 'PGRST001', 'PGRST003', '57014', '08000', '08001', '08003', '08006'].includes(code)
    || /failed to fetch|network|timeout|temporarily unavailable/i.test(String(error?.message || ''));
}

function waitForAuthReadRetry() {
  return new Promise((resolve) => window.setTimeout(resolve, 180));
}

export async function getCurrentUser() {
  const readSession = async () => {
    try {
      return await supabase.auth.getSession();
    } catch (error) {
      return { data: { session: null }, error };
    }
  };
  let sessionResult = await readSession();
  if (sessionResult.error && isTransientProfileError(sessionResult.error)) {
    await waitForAuthReadRetry();
    sessionResult = await readSession();
  }
  if (sessionResult.error && isTerminalSessionError(sessionResult.error)) {
    await discardInvalidLocalSession();
    return null;
  }
  if (sessionResult.error) throw withAuthFailure(sessionResult.error, 'auth_unavailable');
  const { session } = sessionResult.data;
  if (!session?.user) return null;
  let { data: profile, error: profileError } = await readUserProfile(session.user.id);

  // A PWA can resume with an access token that has expired while its refresh
  // request is still in flight. Refresh once, then repeat only this bounded
  // profile read. This keeps the authenticated UI honest without signing a
  // user out on a temporary connection or token race.
  if (profileError && isRefreshableProfileError(profileError)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError && isTerminalSessionError(refreshError)) {
      await discardInvalidLocalSession();
      return null;
    }
    if (!refreshError && refreshed?.session?.user?.id === session.user.id) {
      ({ data: profile, error: profileError } = await readUserProfile(session.user.id));
    }
  } else if (profileError && isTransientProfileError(profileError)) {
    await waitForAuthReadRetry();
    ({ data: profile, error: profileError } = await readUserProfile(session.user.id));
  }

  if (profileError) throw withAuthFailure(
    profileError,
    profileError.code === 'PGRST116' ? 'profile_missing' : 'profile_unavailable',
  );
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
