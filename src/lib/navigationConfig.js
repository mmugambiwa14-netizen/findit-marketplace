import {
  Compass,
  Flag,
  FolderTree,
  LayoutDashboard,
  MessageCircle,
  PlusCircle,
  ScrollText,
  Store,
  UserRound,
  Users,
  Video,
} from 'lucide-react';

export const PRIMARY_NAV_ITEMS = [
  {
    label: 'Discover',
    icon: Compass,
    path: '/',
    guestAllowed: true,
    exact: true,
  },
  {
    label: 'Tours',
    icon: Video,
    path: '/peek',
    guestAllowed: true,
    feature: 'tours',
    previewFeature: 'toursPreview',
  },
  {
    label: 'Post',
    icon: PlusCircle,
    path: '/post',
    guestAllowed: false,
    guestAction: 'post a listing',
    prominent: true,
  },
  {
    label: 'Chats',
    icon: MessageCircle,
    path: '/chats',
    guestAllowed: false,
    guestAction: 'view your marketplace chats',
    feature: 'messaging',
  },
  {
    label: 'Profile',
    icon: UserRound,
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
