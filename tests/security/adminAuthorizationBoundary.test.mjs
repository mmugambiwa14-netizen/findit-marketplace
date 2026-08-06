import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAdminHealthWindow,
  normalizeAdminId,
  normalizeAdminMarketplaceRequest,
  normalizeAdminReason,
  normalizeAdminUsersRequest,
  normalizeMarketplaceModeration,
  normalizeReportDecision,
  normalizeUserRoleChange,
  normalizeUserStatusChange,
} from '../../src/services/adminContracts.js';

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ITEM_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const REASON = 'Violates the prohibited items policy.';

test('admin identifiers reject malformed and injection-shaped values', () => {
  assert.equal(normalizeAdminId(USER_ID), USER_ID);
  for (const value of ["' OR 1=1--", '', 42, null, `${USER_ID} OR 1=1`]) {
    assert.throws(() => normalizeAdminId(value), /is invalid/);
  }
});

test('privileged mutations require a substantive bounded reason', () => {
  assert.equal(normalizeAdminReason(REASON), REASON);
  assert.throws(() => normalizeAdminReason('   '), /required/);
  assert.throws(() => normalizeAdminReason('no'), /required/);
  assert.throws(() => normalizeAdminReason('x'.repeat(1001)), /too long/);
});

test('role assignment accepts only user and admin, never filter-only values', () => {
  assert.deepEqual(
    normalizeUserRoleChange({ userId: USER_ID, role: 'admin', reason: REASON }),
    { userId: USER_ID, role: 'admin', reason: REASON },
  );
  assert.equal(normalizeAdminUsersRequest({ role: 'all' }).role, 'all');
  for (const role of ['all', 'superadmin', 'service_role', 'owner', 'ADMIN', '']) {
    assert.throws(() => normalizeUserRoleChange({ userId: USER_ID, role, reason: REASON }), /invalid/);
  }
});

test('user status changes normalize valid expiry and reject invalid states', () => {
  const banned = normalizeUserStatusChange({
    userId: USER_ID,
    status: 'banned',
    reason: REASON,
    banUntil: '2027-01-01T00:00:00Z',
  });
  assert.equal(banned.banUntil, '2027-01-01T00:00:00.000Z');
  assert.equal(normalizeUserStatusChange({
    userId: USER_ID,
    status: 'suspended',
    reason: REASON,
    banUntil: '2027-01-01T00:00:00Z',
  }).banUntil, null);
  assert.throws(() => normalizeUserStatusChange({ userId: USER_ID, status: 'deleted', reason: REASON }), /invalid/);
  assert.throws(() => normalizeUserStatusChange({ userId: USER_ID, status: 'banned', reason: REASON, banUntil: 'whenever' }), /invalid/);
});

test('marketplace moderation rejects destructive or invented actions', () => {
  assert.deepEqual(
    normalizeMarketplaceModeration({ itemId: ITEM_ID, kind: 'property', action: 'publish', reason: REASON }),
    { itemId: ITEM_ID, kind: 'property', action: 'publish', reason: REASON },
  );
  for (const action of ['delete', 'drop', 'purge', 'all']) {
    assert.throws(() => normalizeMarketplaceModeration({ itemId: ITEM_ID, kind: 'property', action, reason: REASON }), /invalid/);
  }
  assert.throws(() => normalizeMarketplaceModeration({ itemId: ITEM_ID, kind: 'all', action: 'pause', reason: REASON }), /invalid/);
});

test('report decisions accept only terminal moderation outcomes', () => {
  for (const status of ['reviewed', 'dismissed', 'actioned']) {
    assert.equal(normalizeReportDecision({ reportId: ITEM_ID, status, notes: REASON }).status, status);
  }
  assert.throws(() => normalizeReportDecision({ reportId: ITEM_ID, status: 'pending', notes: REASON }), /invalid/);
});

test('admin list requests enforce bounded pagination and cursor validation', () => {
  assert.equal(normalizeAdminUsersRequest({ limit: 100000 }).limit, 100);
  assert.equal(normalizeAdminMarketplaceRequest({ limit: 100000 }).limit, 100);
  assert.equal(normalizeAdminUsersRequest({ limit: 0 }).limit, 1);
  assert.equal(normalizeAdminUsersRequest({ limit: -5 }).limit, 1);
  assert.equal(normalizeAdminUsersRequest({}).limit, 25);
  assert.throws(() => normalizeAdminUsersRequest({ limit: 12.5 }), /invalid/);
  assert.throws(() => normalizeAdminUsersRequest({ query: 'x'.repeat(101) }), /too long/);

  const cursor = { at: '2026-01-01T00:00:00Z', id: ITEM_ID };
  assert.deepEqual(normalizeAdminUsersRequest({ cursor }).cursor, {
    at: '2026-01-01T00:00:00.000Z',
    id: ITEM_ID,
  });
  assert.throws(() => normalizeAdminUsersRequest({ cursor: { at: 'nope', id: ITEM_ID } }), /timestamp is invalid/);
  assert.throws(() => normalizeAdminUsersRequest({ cursor: [] }), /is invalid/);
});

test('admin health windows remain operationally bounded', () => {
  assert.equal(normalizeAdminHealthWindow(), 24);
  assert.throws(() => normalizeAdminHealthWindow(100000), /invalid/);
});
