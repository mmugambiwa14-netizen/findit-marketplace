import { lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, Plus, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS } from '@/lib/navigationConfig';
import { cn } from '@/lib/utils';
import { createLoginPath } from '@/lib/authNavigation';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import ThemeToggle from '@/components/layout/ThemeToggle';

const NotificationBell = lazy(() => import('@/components/layout/NotificationBell'));

function isItemVisible(item) {
  if (!item.feature) return true;
  if (featureFlags[item.feature]) return true;
  return Boolean(item.previewFeature && featureFlags[item.previewFeature]);
}

function CountBadge({ count }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function TopNav() {
  const { user } = useAuth();
  const location = useLocation();
  const unreadMessages = useUnreadMessages();
  const desktopItems = PRIMARY_NAV_ITEMS.filter((item) => !item.prominent && isItemVisible(item));

  return (
    <header className="glass-bar sticky top-0 z-50 hidden border-b px-4 py-3 md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-2xl font-black tracking-tight" aria-label="FindIt Discover">
          <span className="clay-icon h-10 w-10 border-primary/20 bg-primary/10 text-primary">
            <MapPin className="h-5 w-5 fill-primary/15" strokeWidth={2.5} />
          </span>
          <span>
            <span className="text-foreground">Find</span>
            <span className="text-primary">It</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1" aria-label="Primary navigation">
          {desktopItems.map((item) => {
            const Icon = item.icon;
            const active = isNavigationItemActive(location.pathname, item.path, item.exact);
            const count = item.path === '/chats' ? unreadMessages : 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={count > 0 ? `${item.label}, ${count} unread` : item.label}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground',
                  active && 'clay-soft text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <CountBadge count={count} />
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {user && featureFlags.essentialNotifications && (
            <Suspense fallback={null}><NotificationBell /></Suspense>
          )}
          <Link
            to="/post"
            className="clay-button inline-flex h-11 items-center gap-1.5 px-3.5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Post</span>
          </Link>
          <Link
            to={user ? '/profile' : createLoginPath('/profile')}
            className="clay-control inline-flex h-11 min-w-11 items-center justify-center gap-2 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
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
