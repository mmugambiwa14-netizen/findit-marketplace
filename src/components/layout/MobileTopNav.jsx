import { lazy, Suspense } from 'react';
import BrandLogo from '@/components/BrandLogo';
import GlobalRefreshButton from '@/components/pwa/GlobalRefreshButton';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import './mobile-top-nav.css';

const NotificationBell = lazy(() => import('@/components/layout/NotificationBell'));

export default function MobileTopNav() {
  const { user } = useAuth();

  return (
    <header className="findit-shared-mobile-top-nav safe-area-top sticky top-0 z-50 border-b border-border/75 bg-background/92 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex min-h-[60px] max-w-[510px] items-center justify-between px-4">
        <BrandLogo
          className="gap-2"
          markClassName="h-8 w-8"
          wordmarkClassName="text-xl tracking-[-0.04em]"
        />
        <div className="flex h-11 items-center gap-1" aria-label="App actions">
          <GlobalRefreshButton inline />
          {user && featureFlags.essentialNotifications && (
            <Suspense fallback={<span className="h-11 w-11" aria-hidden="true" />}>
              <NotificationBell />
            </Suspense>
          )}
        </div>
      </div>
    </header>
  );
}
