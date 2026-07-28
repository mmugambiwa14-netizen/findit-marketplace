import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS } from '@/lib/navigationConfig';
import { cn } from '@/lib/utils';

function isItemVisible(item) {
  if (!item.feature) return true;
  if (featureFlags[item.feature]) return true;
  return Boolean(item.previewFeature && featureFlags[item.previewFeature]);
}

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('continue');
  const [guestReturnTo, setGuestReturnTo] = useState('/');

  const navItems = useMemo(() => PRIMARY_NAV_ITEMS.filter(isItemVisible), []);

  const handleNavClick = (event, item) => {
    if (!user && !item.guestAllowed) {
      event.preventDefault();
      setGuestAction(item.guestAction || 'continue');
      setGuestReturnTo(item.path);
      setGuestOpen(true);
    }
  };

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(location.pathname, item.path, item.exact);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(event) => handleNavClick(event, item)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-muted-foreground transition-colors focus-visible:z-10',
                  isActive && !item.prominent && 'text-primary',
                  item.prominent && 'text-foreground',
                )}
              >
                {item.prominent ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-95">
                    <Icon aria-hidden="true" className="h-5.5 w-5.5" strokeWidth={2.35} />
                  </span>
                ) : (
                  <Icon
                    aria-hidden="true"
                    className={cn('h-[21px] w-[21px]', isActive && 'fill-primary/10')}
                    strokeWidth={isActive ? 2.4 : 1.8}
                  />
                )}
                <span className={cn('max-w-full truncate text-[10px] font-medium leading-none', item.prominent && '-mt-0.5')}>
                  {item.label}
                </span>
                {isActive && !item.prominent && (
                  <span aria-hidden="true" className="absolute bottom-0 h-0.5 w-5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <GuestPromptSheet
        open={guestOpen}
        onClose={() => setGuestOpen(false)}
        action={guestAction}
        returnTo={guestReturnTo}
      />
    </>
  );
}
