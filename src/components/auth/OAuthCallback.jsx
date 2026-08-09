import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as authService from '@/services/authService';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const bridgeId = searchParams.get('bridge') || '';
  const returnTo = searchParams.get('returnTo') || '/';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    let cancelled = false;

    authService.completeOAuthCallback({ bridgeId, returnTo })
      .then((result) => {
        if (cancelled) return;
        if (result.bridged) {
          setMessage('Sign-in complete. You can return to PeekaListing.');
          window.setTimeout(() => window.close(), 120);
          return;
        }
        window.location.replace(authService.appUrl(result.returnTo));
      })
      .catch((callbackError) => {
        if (cancelled) return;
        setError(callbackError?.message || 'Google sign-in could not be completed.');
        if (bridgeId) window.setTimeout(() => window.close(), 180);
      });

    return () => { cancelled = true; };
  }, [bridgeId, returnTo]);

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card" aria-live="polite">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Sign-in was not completed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <a href={authService.appUrl('/login')} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">{message}</h1>
            <p className="mt-2 text-sm text-muted-foreground">This window will close automatically.</p>
          </>
        )}
      </section>
    </main>
  );
}
