import { Outlet, useLocation } from 'react-router-dom';
import { GuestBanner } from '@/components/auth/GuestPromptSheet';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from './BottomNav';
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
];

function matchesRoute(pathname, route) {
  return route.endsWith('/')
    ? pathname.startsWith(route)
    : pathname === route || pathname.startsWith(`${route}/`);
}

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const selfContained = SELF_CONTAINED_ROUTES.some((route) => matchesRoute(location.pathname, route));
  const isDiscoverHome = location.pathname === '/';

  return (
    <div className="findit-screen min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[1100] -translate-y-24 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-floating transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      {!selfContained && <TopNav />}
      <main id="main-content" tabIndex={-1} className="min-h-[70vh] pb-28 md:pb-0">
        <Outlet />
      </main>
      {!selfContained && <div className="hidden md:block"><SiteFooter /></div>}
      {!selfContained && !isDiscoverHome && <GuestBanner user={user} />}
      <BottomNav />
    </div>
  );
}
