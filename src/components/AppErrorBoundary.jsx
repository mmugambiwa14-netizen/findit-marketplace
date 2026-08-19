import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as authService from '@/services/authService';
import BrandLogo from '@/components/BrandLogo';
import { reportClientError } from '@/lib/errorMonitoring';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled application render error:', error, info);
    reportClientError(error, 'render-boundary');
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg" aria-labelledby="app-error-title">
          <BrandLogo className="mb-6" markClassName="h-9 w-9" wordmarkClassName="text-xl" />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <h1 id="app-error-title" className="mt-4 text-2xl font-bold">PeekaListing could not display this screen</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your account and marketplace data have not been changed. Reload the page or return to Discover.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reload
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign(authService.appUrl('/'))}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Discover
            </Button>
          </div>
        </section>
      </main>
    );
  }
}
