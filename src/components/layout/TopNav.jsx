import { lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS } from '@/lib/navigationConfig';
import { cn } from '@/lib/utils';
import { createLoginPath } from '@/lib/authNavigation';

const NotificationBell = lazy(() => import('@/components/layout/NotificationBell'));

function isItemVisible(item) {
  if (!item.feature) return true;
  if (featureFlags[item.feature]) return true;
  return Boolean(item.previewFeature && featureFlags[item.previewFeature]);
}

export default function TopNav() {
  const { user } = useAuth();
  const location = useLocation();
  const desktopItems = PRIMARY_NAV_ITEMS.filter((item) => !item.prominent && isItemVisible(item));

  return (
    <header className="glass-bar sticky top-0 z-50 border-b px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
        <Link to="/" className="shrink-0 text-xl font-black tracking-tight sm:text-2xl" aria-label="FindIt Discover">
          <span className="text-foreground">FIND</span>
          <span className="text-primary">it</span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" aria-label="Primary navigation">
          {desktopItems.map((item) => {
            const Icon = item.icon;
            const active = isNavigationItemActive(location.pathname, item.path, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground',
                  active && 'bg-surface-raised text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {user && featureFlags.essentialNotifications && (
            <Suspense fallback={null}><NotificationBell /></Suspense>
          )}
          <Link
            to="/post"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Post</span>
          </Link>
          <Link
            to={user ? '/profile' : createLoginPath('/profile')}
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={user ? 'Open profile' : 'Sign in'}
          >
            <UserRound className="h-[18px] w-[18px]" />
            <span className="hidden lg:inline">{user ? 'Profile' : 'Sign in'}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
