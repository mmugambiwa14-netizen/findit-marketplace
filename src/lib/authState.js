export const AUTH_ERROR_TYPES = Object.freeze({
  PROFILE_MISSING: 'profile_missing',
  PROFILE_UNAVAILABLE: 'profile_unavailable',
  AUTH_UNAVAILABLE: 'auth_unavailable',
});

const OPTIONAL_PROFILE_COLUMNS = Object.freeze([
  'display_name',
  'public_address',
  'website_url',
  'avatar_storage_path',
]);

export function isTerminalSessionError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  return [
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
  ].includes(code)
    || (status === 400 && /invalid refresh token|refresh token (?:not found|already used|revoked)/i.test(message));
}

export function isOptionalProfileSchemaError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  if (!['42703', 'PGRST204'].includes(code) && Number(error?.status) !== 400) return false;
  return OPTIONAL_PROFILE_COLUMNS.some((column) => message.includes(column));
}

export function deriveAuthState(currentUser) {
  if (!currentUser) {
    return {
      user: null,
      isAuthenticated: false,
      blockedAccount: null,
    };
  }

  if (currentUser.status === 'suspended' || currentUser.status === 'banned') {
    return {
      user: null,
      isAuthenticated: false,
      blockedAccount: {
        status: currentUser.status,
        reason: currentUser.ban_reason || null,
        banUntil: currentUser.ban_until || null,
      },
    };
  }

  return {
    user: currentUser,
    isAuthenticated: true,
    blockedAccount: null,
  };
}

export function toAuthError(error) {
  if (error?.finditAuthFailure === AUTH_ERROR_TYPES.PROFILE_MISSING) {
    return {
      type: AUTH_ERROR_TYPES.PROFILE_MISSING,
      message: 'Your account profile could not be found. Please contact support if this continues.',
    };
  }

  if (error?.finditAuthFailure === AUTH_ERROR_TYPES.PROFILE_UNAVAILABLE) {
    return {
      type: AUTH_ERROR_TYPES.PROFILE_UNAVAILABLE,
      message: 'You are signed in, but your profile could not be loaded. Please try again.',
    };
  }

  return {
    type: AUTH_ERROR_TYPES.AUTH_UNAVAILABLE,
    message: 'We could not verify your sign-in status. Check your connection and try again.',
  };
}
