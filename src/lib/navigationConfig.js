import {
  CircleUserRound,
  Clapperboard,
  Flag,
  FolderTree,
  LayoutDashboard,
  MapPinned,
  MessagesSquare,
  Plus,
  ScrollText,
  Store,
  Users,
} from 'lucide-react';

export const PRIMARY_NAV_ITEMS = [
  {
    label: 'Discover',
    icon: MapPinned,
    path: '/',
    guestAllowed: true,
    exact: true,
  },
  {
    label: 'Tours',
    icon: Clapperboard,
    path: '/peek',
    guestAllowed: true,
    feature: 'tours',
    previewFeature: 'toursPreview',
  },
  {
    label: 'Post',
    icon: Plus,
    path: '/post',
    guestAllowed: false,
    guestAction: 'post a listing',
    prominent: true,
  },
  {
    label: 'Chats',
    icon: MessagesSquare,
    path: '/chats',
    guestAllowed: false,
    guestAction: 'view your marketplace chats',
    feature: 'messaging',
  },
  {
    label: 'Profile',
    icon: CircleUserRound,
    path: '/profile',
    guestAllowed: false,
    guestAction: 'manage your profile',
  },
];

// One source for the six implemented V1 admin destinations.
export const ADMIN_NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Marketplace', icon: Store, path: '/admin/listings' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Reports', icon: Flag, path: '/admin/reports', countKey: 'reports' },
  { label: 'Categories', icon: FolderTree, path: '/admin/categories' },
  { label: 'Audit Log', icon: ScrollText, path: '/admin/audit-log' },
];

export function isNavigationItemActive(pathname, itemPath, exact = false) {
  if (exact || itemPath === '/' || itemPath === '/admin') return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
