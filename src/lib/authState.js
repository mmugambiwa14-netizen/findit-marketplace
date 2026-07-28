export const AUTH_ERROR_TYPES = Object.freeze({
  PROFILE_MISSING: 'profile_missing',
  AUTH_UNAVAILABLE: 'auth_unavailable',
});

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

  return {
    type: AUTH_ERROR_TYPES.AUTH_UNAVAILABLE,
    message: 'We could not verify your sign-in status. Check your connection and try again.',
  };
}
