import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import * as authService from '@/services/authService';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
    <span className="sr-only">Checking access</span>
  </div>
);

/**
 * @param {{
 *   fallback?: React.ReactElement,
 *   unauthenticatedElement: React.ReactNode,
 *   requiredRole?: string
 * }} props
 */
export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement, requiredRole }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, logout } = useAuth();
  const [roleVerified, setRoleVerified] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [roleError, setRoleError] = useState(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  // Re-check role in Supabase/Postgres rather than trusting the profile held
  // in React state. A provider or network failure is not an authorization
  // denial, so keep it as a separately retryable state.
  useEffect(() => {
    let cancelled = false;

    const finishVerification = (verified) => {
      if (!cancelled) {
        setRoleVerified(verified);
        setRoleError(null);
        setVerifying(false);
      }
    };

    if (!requiredRole) {
      finishVerification(true);
    } else if (!authChecked || isLoadingAuth) {
      setRoleVerified(false);
      setRoleError(null);
      setVerifying(true);
    } else if (!isAuthenticated || authError) {
      finishVerification(false);
    } else {
      setRoleVerified(false);
      setRoleError(null);
      setVerifying(true);
      authService.hasRequiredRole(requiredRole)
        .then(finishVerification)
        .catch((error) => {
          if (!cancelled) {
            setRoleVerified(false);
            setRoleError(error instanceof Error ? error : new Error('Role verification failed.'));
            setVerifying(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoadingAuth, requiredRole, authChecked, authError, verificationAttempt]);

  if (isLoadingAuth || !authChecked || (requiredRole && verifying)) {
    return fallback;
  }

  if (authError?.type === 'profile_missing') {
    return <UserNotRegisteredError onRetry={checkUserAuth} onSignOut={logout} />;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (requiredRole && roleError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center" role="alert" aria-labelledby="role-check-title">
          <h1 id="role-check-title" className="text-2xl font-bold">We could not verify your access</h1>
          <p className="mt-2 text-sm text-muted-foreground">The permission service is temporarily unavailable. No access decision has been made.</p>
          <button
            type="button"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            onClick={() => setVerificationAttempt((attempt) => attempt + 1)}
          >
            Try again
          </button>
        </section>
      </div>
    );
  }

  if (requiredRole && !roleVerified) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <section className="text-center" aria-labelledby="access-denied-title">
          <h1 id="access-denied-title" className="mb-2 text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
        </section>
      </div>
    );
  }

  return <Outlet />;
}
