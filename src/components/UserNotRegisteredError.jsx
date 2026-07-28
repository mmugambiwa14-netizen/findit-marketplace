import { AlertTriangle, LifeBuoy, LogOut, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SiteFooter from '@/components/layout/SiteFooter';

export default function UserNotRegisteredError({ onRetry, onSignOut }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg sm:p-8" aria-labelledby="profile-missing-title">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-7 w-7 text-warning" aria-hidden="true" />
          </div>
          <h1 id="profile-missing-title" className="text-2xl font-bold">Account profile unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your sign-in is valid, but the marketplace profile linked to it could not be found. This can happen when account setup was interrupted.
          </p>
          <div className="mt-6 space-y-3">
            {onRetry && (
              <Button type="button" className="w-full" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Retry profile check
              </Button>
            )}
            <Button type="button" variant="outline" className="w-full" asChild>
              <Link to="/help/contact">
                <LifeBuoy className="mr-2 h-4 w-4" aria-hidden="true" />
                Contact support
              </Link>
            </Button>
            {onSignOut && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => onSignOut(true)}>
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            )}
          </div>
        </section>
      </main>
      <SiteFooter compact />
    </div>
  );
}
