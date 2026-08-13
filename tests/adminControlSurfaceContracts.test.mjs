import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ADMIN_NAV_ITEMS } from '../src/lib/navigationConfig.js';
import {
  ADMIN_AUDIT_TARGET_OPTIONS,
  ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS,
  ADMIN_MANAGED_LISTING_STATUS_OPTIONS,
  ADMIN_PEEK_QUEUE_STATUS_OPTIONS,
  ADMIN_REPORT_KIND_OPTIONS,
  businessApplicationActions,
  businessCategoryActions,
  managedListingActions,
  marketplaceActions,
} from '../src/services/adminConfig.js';
import {
  canTransitionBusinessApplication,
  normalizeAdminBusinessApplicationReview,
  normalizeAdminBusinessApplicationsRequest,
  normalizeAdminBusinessCategoryReview,
  normalizeAdminManagedListingRequestsRequest,
  normalizeAdminManagedListingUpdate,
} from '../src/services/adminBusinessContracts.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [app, supportPage, reportsPage, peekPage, listingsPage, usersPage, businessPage, managedPage, categoriesPage, auditPage, supportEntry, sidebar, migration, matrix, managedService] = await Promise.all([
  read('src/App.jsx'),
  read('src/pages/admin/AdminSupportRequests.jsx'),
  read('src/pages/admin/AdminReports.jsx'),
  read('src/pages/admin/AdminPeeks.jsx'),
  read('src/pages/admin/AdminListings.jsx'),
  read('src/pages/admin/AdminUsers.jsx'),
  read('src/pages/admin/AdminBusinessApplications.jsx'),
  read('src/pages/admin/AdminManagedListings.jsx'),
  read('src/pages/admin/AdminCategories.jsx'),
  read('src/pages/admin/AdminAuditLog.jsx'),
  read('src/components/admin/SupportRequestInbox.jsx'),
  read('src/components/admin/AdminSidebarCollapsible.jsx'),
  read('supabase/migrations/20260813090638_admin_control_audit_hardening.sql'),
  read('artifacts/extensive-audit/admin-control-matrix.json'),
  read('src/services/adminBusinessPublishingService.js'),
]);

const ID = '00000000-0000-4000-8000-000000000001';

test('every founder navigation item has a protected route', () => {
  const routePaths = [...app.matchAll(/<Route path="(\/admin[^" ]*)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(routePaths), new Set(ADMIN_NAV_ITEMS.map((item) => item.path)));
  assert.match(app, /requiredRole="admin"/);
});

test('the routed Peek page and support page point at the canonical implementations', () => {
  assert.match(peekPage, /AdminTourQueue/);
  assert.match(reportsPage, /to="\/admin\/support"/);
  assert.doesNotMatch(reportsPage, /SupportRequestInbox/);
  assert.match(supportPage, /ADMIN_SUPPORT_STATUS_OPTIONS/);
  assert.match(supportPage, /ADMIN_SUPPORT_CATEGORY_OPTIONS/);
  assert.match(sidebar, /Escape/);
  assert.match(sidebar, /PeekaListing admin overview/);
});

test('admin pages consume canonical option/action contracts instead of closed local vocabularies', () => {
  for (const [source, names] of [
    [listingsPage, ['ADMIN_MARKETPLACE_KIND_OPTIONS', 'ADMIN_MARKETPLACE_STATUS_OPTIONS', 'marketplaceActions']],
    [usersPage, ['ADMIN_USER_ROLE_OPTIONS', 'ADMIN_USER_STATUS_OPTIONS']],
    [reportsPage, ['ADMIN_REPORT_KIND_OPTIONS', 'ADMIN_REPORT_STATUS_OPTIONS', 'ADMIN_REPORT_REASON_LABELS']],
    [businessPage, ['ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS', 'businessApplicationActions', 'businessCategoryActions']],
    [managedPage, ['ADMIN_MANAGED_LISTING_STATUS_OPTIONS', 'managedListingActions']],
    [categoriesPage, ['ADMIN_TAXONOMY_NODE_TYPE_OPTIONS']],
    [auditPage, ['ADMIN_AUDIT_TARGET_OPTIONS']],
  ]) {
    for (const name of names) assert.match(source, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(supportEntry, /Compatibility entry point|canonical/i);
});

test('canonical admin filters contain every active server-supported value', () => {
  assert.deepEqual(ADMIN_PEEK_QUEUE_STATUS_OPTIONS.map((option) => option.value), ['pending', 'reported', 'failed', 'rejected', 'approved', 'all']);
  assert.equal(ADMIN_REPORT_KIND_OPTIONS.find((option) => option.value === 'tour')?.label, 'Peeks');
  assert.equal(ADMIN_AUDIT_TARGET_OPTIONS.some((option) => option.value === 'business_application'), true);
  assert.equal(ADMIN_AUDIT_TARGET_OPTIONS.some((option) => option.value === 'managed_listing_request'), true);
  assert.equal(ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS.some((option) => option.value === 'withdrawn'), true);
  assert.equal(ADMIN_MANAGED_LISTING_STATUS_OPTIONS.some((option) => option.value === 'cancelled'), true);
});

test('business and managed admin action matrices are state-aware', () => {
  assert.deepEqual(businessApplicationActions('approved'), []);
  assert.deepEqual(businessApplicationActions('submitted').map((action) => action.value), ['start_review', 'request_information', 'reject']);
  assert.equal(canTransitionBusinessApplication('reviewing', 'start_review'), false);
  assert.equal(canTransitionBusinessApplication('needs_information', 'start_review'), true);
  assert.deepEqual(businessCategoryActions('suspended').map((action) => action.value), ['approve']);
  assert.deepEqual(managedListingActions('accepted').map((action) => action.value), ['published', 'cancelled']);
  assert.deepEqual(managedListingActions('published'), []);
  assert.equal(marketplaceActions({ item_kind: 'car', status: 'pending_review' }).some((action) => action.value === 'reject'), true);
});

test('business admin request boundaries normalize IDs, cursors, actions, and required messages', () => {
  assert.deepEqual(normalizeAdminBusinessApplicationsRequest({ status: 'withdrawn', limit: 500, before: '2026-08-13T09:00:00Z' }), {
    status: 'withdrawn', limit: 100, before: '2026-08-13T09:00:00.000Z',
  });
  assert.deepEqual(normalizeAdminBusinessApplicationReview({ applicationId: ID, action: 'reject', reviewerMessage: 'Incomplete verification' }).reviewerMessage, 'Incomplete verification');
  assert.throws(() => normalizeAdminBusinessApplicationReview({ applicationId: ID, action: 'reject' }), /message is required/);
  assert.deepEqual(normalizeAdminBusinessCategoryReview({ categoryApprovalId: ID, action: 'suspend', reviewerMessage: 'Policy breach' }).action, 'suspend');
  assert.deepEqual(normalizeAdminManagedListingRequestsRequest({ status: 'cancelled', limit: 2 }).status, 'cancelled');
  assert.throws(() => normalizeAdminManagedListingUpdate({ requestId: ID, status: 'cancelled' }), /message is required/);
  assert.deepEqual(normalizeAdminManagedListingUpdate({ requestId: ID, status: 'cancelled', reviewerMessage: 'Owner withdrew request' }), {
    requestId: ID, status: 'cancelled', reviewerMessage: 'Owner withdrew request', assignedTo: null,
  });
});

test('server-side managed moderation closes the client-only bypass and records audit evidence', () => {
  assert.match(migration, /create or replace function private\.audit_business_review_event/);
  assert.match(migration, /create trigger business_review_events_audit/);
  assert.match(migration, /create or replace function private\.admin_update_managed_listing_request/);
  assert.match(migration, /Invalid managed listing state transition/);
  assert.match(migration, /p_status in \('needs_information', 'declined', 'cancelled'\)/);
  assert.match(migration, /managed_listing\.status_changed/);
  assert.match(migration, /record_admin_action/);
});

test('the committed matrix names the same ten founder routes', () => {
  const controlMatrix = JSON.parse(matrix);
  assert.deepEqual(controlMatrix.routes.map((route) => route.path), ADMIN_NAV_ITEMS.map((item) => item.path));
  assert.equal(controlMatrix.crossCuttingControls.canonicalVocabulary, 'src/services/adminConfig.js');
});

test('business queues expose visible keyset paging and managed requests wire reviewer assignment', () => {
  assert.match(businessPage, /<CursorPager/);
  assert.match(businessPage, /before: pagination\.cursor/);
  assert.match(businessPage, /<AdminQueryError/);
  assert.match(managedPage, /<CursorPager/);
  assert.match(managedPage, /<AdminQueryError/);
  assert.match(managedPage, /Assigned reviewer/);
  assert.match(managedPage, /assignments\[row\.id\]/);
  assert.match(managedService, /Math\.min\(request\.limit \+ 1, 100\)/);
  assert.match(managedService, /pageRows\(data, request\.limit, 'created_at'\)/);
});
