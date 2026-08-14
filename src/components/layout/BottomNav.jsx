import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import { Pressable } from '@/components/ui/pressable';
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
      <nav aria-label="Mobile navigation" className="findit-mobile-nav fixed bottom-0 z-40 md:hidden">
        <div className="clay-nav flex w-full items-stretch rounded-[var(--findit-panel-radius)] px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(location.pathname, item.path, item.exact);
            const count = item.path === '/chats' ? unreadMessages : 0;
            return (
              <Pressable
                key={item.path}
                asChild
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[var(--findit-control-radius)] px-1 text-muted-foreground focus-visible:z-10',
                  item.prominent ? 'justify-center' : 'justify-end pb-0.5',
                  isActive && !item.prominent && 'text-primary',
                  item.prominent && 'text-foreground',
                )}
              >
                <Link
                  to={item.path}
                  onClick={(event) => handleNavClick(event, item)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={count > 0 ? `${item.label}, ${count} unread` : item.label}
                >
                  {item.prominent ? (
                    <span className="clay-button -mt-5 flex h-14 w-14 items-center justify-center rounded-full ring-[3px] ring-background/90">
                      <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.2} />
                    </span>
                  ) : (
                    <span className={cn('relative flex h-9 w-9 items-center justify-center rounded-[var(--findit-control-radius-sm)] transition-[background-color,color,box-shadow,transform]', isActive ? 'findit-active-nav-item scale-[1.025]' : 'text-muted-foreground hover:bg-surface-raised/70 hover:text-foreground')}>
                      <Icon aria-hidden="true" className="h-[var(--findit-nav-icon-size)] w-[var(--findit-nav-icon-size)]" strokeWidth={isActive ? 2.25 : 1.85} />
                      {count > 0 && <span aria-hidden="true" className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-card">{count > 99 ? '99+' : count}</span>}
                    </span>
                  )}
                  <span className={cn('max-w-full truncate text-[var(--findit-nav-label-size)] font-semibold leading-none tracking-[-0.01em]', item.prominent && '-mt-0.5', isActive && !item.prominent && 'font-bold text-primary')}>{item.label}</span>
                </Link>
              </Pressable>
            );
          })}
        </div>
      </nav>
      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} returnTo={guestReturnTo} />
    </>
  );
}
