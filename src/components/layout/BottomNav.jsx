import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS } from '@/lib/navigationConfig';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

function isItemVisible(item) {
  if (!item.feature) return true;
  if (featureFlags[item.feature]) return true;
  return Boolean(item.previewFeature && featureFlags[item.previewFeature]);
}

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const unreadMessages = useUnreadMessages();
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
        className="safe-area-bottom fixed inset-x-3 bottom-2 z-[1000] md:hidden"
      >
        <div className="clay-nav mx-auto flex h-[72px] max-w-[470px] items-stretch rounded-[1.45rem] px-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(location.pathname, item.path, item.exact);
            const count = item.path === '/chats' ? unreadMessages : 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(event) => handleNavClick(event, item)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={count > 0 ? `${item.label}, ${count} unread` : item.label}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-muted-foreground focus-visible:z-10',
                  isActive && !item.prominent && 'text-primary',
                  item.prominent && 'text-foreground',
                )}
              >
                {item.prominent ? (
                  <span className="clay-button -mt-6 flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-background/90">
                    <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.15} />
                  </span>
                ) : (
                  <span
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform]',
                      isActive
                        ? 'text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/.55)]'
                        : 'text-muted-foreground',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-[19px] w-[19px]"
                      strokeWidth={isActive ? 2.25 : 1.85}
                    />
                    {count > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-card"
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </span>
                )}
                <span
                  className={cn(
                    'max-w-full truncate text-[10px] font-medium leading-none',
                    item.prominent && '-mt-0.5',
                    isActive && !item.prominent && 'text-primary',
                  )}
                >
                  {item.label}
                </span>
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
