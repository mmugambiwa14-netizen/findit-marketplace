// src/lib/AuthContext.jsx
//
// Phase 2A. Replaces: base44.auth.me() / .logout() / .redirectToLogin() and
// the axios-based "app public settings" bootstrap in the old version of this
// file. See docs/AUTH_MIGRATION_PLAN.md before changing anything here.
//
// The public shape of this context (user, isAuthenticated, isLoadingAuth,
// isLoadingPublicSettings, authError, blockedAccount, appPublicSettings,
// authChecked, logout, navigateToLogin, checkUserAuth, checkAppState) is
// kept identical to the Base44 version on purpose: every other file that
// calls useAuth() (ProtectedRoute, App.jsx, useGuestGuard, etc.) needs zero
// changes in this checkpoint.

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import * as authService from '@/services/authService';
import { deriveAuthState, toAuthError } from '@/lib/authState';
import { localPreviewAuthBypassEnabled } from '@/lib/localPreview';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [blockedAccount, setBlockedAccount] = useState(null); // { status, reason, banUntil } when suspended/banned

  // Base44 had a separate "app public settings" bootstrap (a multi-tenant
  // app-platform concept: is this app configured, is auth required for it,
  // is this user registered *for this app*). Supabase has no equivalent --
  // there's just a user account or there isn't one. These two fields are
  // kept ONLY so App.jsx (the sole other consumer) doesn't need changes in
  // this checkpoint: isLoadingPublicSettings resolves immediately since
  // there's nothing left to fetch. authError is reserved for a real
  // unavailable-auth/profile-integrity state rather than a guest session.
  const [isLoadingPublicSettings] = useState(false);
  const [appPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await authService.getCurrentUser();

      const nextAuthState = deriveAuthState(currentUser);
      setUser(nextAuthState.user);
      setIsAuthenticated(nextAuthState.isAuthenticated);
      setBlockedAccount(nextAuthState.blockedAccount);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setBlockedAccount(null);
      setAuthError(toAuthError(error));
      setIsLoadingAuth(false);
      setAuthChecked(true);
      // Do not represent an unavailable provider or missing profile as guest.
    }
  }, []);

  useEffect(() => {
    if (localPreviewAuthBypassEnabled()) {
      setUser(null);
      setIsAuthenticated(false);
      setBlockedAccount(null);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return undefined;
    }

    void checkUserAuth();
    let authRefreshTimer = null;
    // Supabase pushes session changes (sign-in, sign-out, token refresh)
    // instead of Base44's single check-on-mount -- this is an improvement
    // over polling, not just a like-for-like swap, and it's what makes
    // logging out in one tab reflect in another without a reload.
    const unsubscribe = authService.onAuthStateChange(() => {
      // supabase-js currently deadlocks the next client request when an auth
      // listener starts another async client call before the listener returns.
      // Defer the profile refresh to the next task so public and authenticated
      // PostgREST calls cannot be left pending indefinitely.
      if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer);
      authRefreshTimer = window.setTimeout(() => {
        authRefreshTimer = null;
        void checkUserAuth();
      }, 0);
    });
    return () => {
      if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer);
      unsubscribe();
    };
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    try {
      // Do not render a guest state before the provider has actually cleared
      // the session. A failed sign-out must leave the authenticated UI honest.
      await authService.signOut(shouldRedirect ? window.location.href : undefined);
      if (!shouldRedirect) {
        setUser(null);
        setIsAuthenticated(false);
        setBlockedAccount(null);
        setAuthError(null);
      }
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      await checkUserAuth();
      return false;
    }
  };

  const navigateToLogin = () => {
    // Base44's redirectToLogin() sent the user to Base44's own hosted login
    // page. There is no such hosted page anymore -- FindIt has its own
    // /login route (src/pages/Login.jsx), so this is a real (necessary)
    // behavior change, not an oversight: it's part of what "replace login"
    // means once Base44 no longer hosts auth pages.
    window.location.href = authService.appUrl('/login');
  };

  // Kept as a no-op alias for the old Base44 bootstrap step so nothing that
  // still calls checkAppState() breaks; it now just re-runs the (single)
  // Supabase auth check.
  const checkAppState = checkUserAuth;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      blockedAccount,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
