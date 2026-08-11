import { Outlet, useLocation } from 'react-router-dom';
import { GuestBanner } from '@/components/auth/GuestPromptSheet';
import ActiveConversationAutoScroll from '@/components/messaging/ActiveConversationAutoScroll';
import PeekRequestIntentHandler from '@/components/peekThreads/PeekRequestIntentHandler';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import BottomNav from './BottomNav';
import MobileTopNav from './MobileTopNav';
import SiteFooter from './SiteFooter';
import TopNav from './TopNav';

const SELF_CONTAINED_ROUTES = [
  '/post',
  '/create',
  '/property/',
  '/car/',
  '/machinery/',
  '/service/',
  '/search',
  '/services',
  '/tours',
  '/peek',
  '/chats',
  '/messages',
  '/notifications',
  '/my-listings',
  '/my-services',
  '/saved',
  '/profile',
  '/settings',
  '/business-profiles',
  '/business/',
  '/dealer/',
  '/help',
  '/legal',
];

const MOBILE_NAV_ROUTES = new Set([
  '/',
  '/search',
  '/services',
  '/peek',
  '/chats',
  '/profile',
  '/saved',
  '/notifications',
  '/my-listings',
  '/my-services',
]);

const LISTING_DETAIL_PREFIXES = ['/property/', '/car/', '/machinery/', '/service/'];

function matchesRoute(pathname, route) {
  return route.endsWith('/')
    ? pathname.startsWith(route)
    : pathname === route || pathname.startsWith(`${route}/`);
}

function isImmersiveDesktopRoute(pathname) {
  return pathname.startsWith('/chats/') || pathname.startsWith('/messages/');
}

function isImmersivePeekRoute(pathname) {
  return pathname === '/peek' || pathname.startsWith('/peek/');
}

function isListingDetailRoute(pathname) {
  return LISTING_DETAIL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const selfContained = SELF_CONTAINED_ROUTES.some((route) => matchesRoute(location.pathname, route));
  const isDiscoverHome = location.pathname === '/';
  const showMobileNav = MOBILE_NAV_ROUTES.has(location.pathname);
  const immersiveConversation = isImmersiveDesktopRoute(location.pathname);
  const immersivePeek = isImmersivePeekRoute(location.pathname);
  const listingDetail = isListingDetailRoute(location.pathname);
  const showDesktopNav = !immersiveConversation && !immersivePeek;
  const showSharedMobileTopBar = !immersiveConversation && !immersivePeek && !listingDetail;

  return (
    <div className="findit-screen min-h-[100dvh]">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[1100] -translate-y-24 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-floating transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      {showDesktopNav && <TopNav />}
      {showSharedMobileTopBar && <MobileTopNav />}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          'min-h-[70vh]',
          showMobileNav && 'findit-mobile-nav-clearance',
        )}
      >
        <PeekRequestIntentHandler />
        <Outlet />
        {isDiscoverHome && <div className="md:hidden"><SiteFooter compact /></div>}
      </main>
      {!selfContained && <div className="hidden md:block"><SiteFooter /></div>}
      {!selfContained && !isDiscoverHome && <GuestBanner user={user} />}
      {showMobileNav && <BottomNav />}
      {immersiveConversation && <ActiveConversationAutoScroll />}
    </div>
  );
}
