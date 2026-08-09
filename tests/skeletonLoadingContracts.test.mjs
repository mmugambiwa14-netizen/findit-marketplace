import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  primitive,
  templates,
  app,
  protectedRoute,
  detailLayout,
  map,
  searchMap,
  chats,
  profile,
  notifications,
  adminListings,
  adminAudit,
] = await Promise.all([
  read('../src/components/ui/skeleton.jsx'),
  read('../src/components/loading/LoadingSkeletons.jsx'),
  read('../src/App.jsx'),
  read('../src/components/ProtectedRoute.jsx'),
  read('../src/components/listings/ListingDetailLayout.jsx'),
  read('../src/components/discover/DiscoverMapView.jsx'),
  read('../src/components/search/SearchResultsMap.jsx'),
  read('../src/pages/Inquiries.jsx'),
  read('../src/pages/Profile.jsx'),
  read('../src/pages/NotificationCenter.jsx'),
  read('../src/pages/admin/AdminListings.jsx'),
  read('../src/pages/admin/AdminAuditLog.jsx'),
]);

test('shared skeletons announce busy content and respect reduced-motion preferences', () => {
  assert.match(primitive, /role="status"/);
  assert.match(primitive, /aria-live="polite"/);
  assert.match(primitive, /aria-busy="true"/);
  assert.match(primitive, /motion-reduce:animate-none/);
  assert.match(templates, /AppShellSkeleton/);
  assert.match(templates, /DetailPageSkeleton/);
  assert.match(templates, /MapPanelSkeleton/);
  assert.match(templates, /ConversationThreadSkeleton/);
  assert.match(templates, /TableRowsSkeleton/);
});

test('route, access and detail loading no longer block on centered spinners', () => {
  assert.match(app, /AppShellSkeleton/);
  assert.match(protectedRoute, /AppShellSkeleton/);
  assert.match(detailLayout, /DetailPageSkeleton/);
  assert.doesNotMatch(`${app}\n${protectedRoute}\n${detailLayout}`, /border-t-primary.*animate-spin|animate-spin.*border-t-primary/);
});

test('maps keep a skeleton until both data and the map canvas are ready', () => {
  assert.match(map, /MapPanelSkeleton/);
  assert.match(map, /MapCanvasSkeleton/);
  assert.match(map, /setMapReady\(true\)/);
  assert.match(searchMap, /MapCanvasSkeleton/);
  assert.match(searchMap, /setMapReady\(true\)/);
});

test('account surfaces and founder tables use content-shaped loaders', () => {
  assert.match(chats, /ConversationListSkeleton/);
  assert.match(profile, /ProfilePageSkeleton/);
  assert.match(notifications, /NotificationListSkeleton/);
  assert.match(adminListings, /TableRowsSkeleton/);
  assert.match(adminAudit, /TableRowsSkeleton/);
});
