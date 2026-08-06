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

export function appUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

function withAuthFailure(error, finditAuthFailure) {
  return Object.assign(new Error(error.message), { cause: error, finditAuthFailure });
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
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: appUrl(redirectPath) } });
  if (error) throw error;
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

export async function signUp({ email, password, phone, redirectPath = '/' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone }, emailRedirectTo: appUrl(redirectPath) },
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
