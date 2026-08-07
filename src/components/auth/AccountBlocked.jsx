import { useState } from 'react';
import { Ban, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as authService from '@/services/authService';
import SiteFooter from '@/components/layout/SiteFooter';

export default function AccountBlocked({ status, reason, banUntil }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const isBanned = status === 'banned';

  const returnToLogin = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      await authService.signOut('/login');
    } catch {
      setSignOutError('We could not sign you out. Check your connection and try again.');
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg" aria-labelledby="account-status-title">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isBanned ? 'bg-destructive/10' : 'bg-warning/10'}`}>
            {isBanned ? <Ban className="h-7 w-7 text-destructive" aria-hidden="true" /> : <Clock className="h-7 w-7 text-warning" aria-hidden="true" />}
          </div>
          <h1 id="account-status-title" className="mb-2 text-xl font-bold">
            {isBanned ? 'Your account has been banned' : 'Your account is suspended'}
          </h1>
          <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
            {isBanned ? 'You no longer have access to PeekaListing.' : 'Your access to PeekaListing is temporarily restricted.'}
          </p>
          {reason && <p className="mt-3 text-sm text-foreground"><span className="font-semibold">Reason:</span> {reason}</p>}
          {banUntil && (
            <p className="mt-1 text-xs text-muted-foreground">
              Restriction in effect until {new Date(banUntil).toLocaleDateString()}
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">If you believe this is a mistake, contact the support team.</p>
          {signOutError && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{signOutError}</p>}
          <Button type="button" variant="outline" className="mt-6 w-full" onClick={returnToLogin} disabled={signingOut}>
            {signingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {signingOut ? 'Signing out…' : 'Back to login'}
          </Button>
        </section>
      </main>
      <SiteFooter compact />
    </div>
  );
}
