import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAdminMarketplaceRequest,
  normalizeAdminSupportRequestsRequest,
  normalizeAdminTourDecision,
  normalizeAdminTourQueueRequest,
  normalizeAdminUsersRequest,
  normalizeCategoryCreate,
  normalizeCategoryUpdate,
  normalizeMarketplaceModeration,
  normalizeReportDecision,
  normalizeSupportResolution,
  normalizeUserRoleChange,
  normalizeUserStatusChange,
} from '../src/services/adminContracts.js';

const ID = '00000000-0000-4000-8000-000000000001';

test('admin marketplace requests use bounded cursor pagination', () => {
  assert.deepEqual(normalizeAdminMarketplaceRequest({ query: '  hilux ', limit: 500, cursor: { at: '2026-07-27T10:00:00Z', id: ID } }), {
    query: 'hilux', kind: 'all', status: 'all', limit: 100, cursor: { at: '2026-07-27T10:00:00.000Z', id: ID },
  });
  assert.throws(() => normalizeAdminMarketplaceRequest({ kind: 'legal' }), /kind is invalid/);
  assert.throws(() => normalizeAdminMarketplaceRequest({ cursor: { at: 'not-a-date', id: ID } }), /timestamp is invalid/);
});

test('marketplace moderation requires a supported operation and reason', () => {
  assert.deepEqual(normalizeMarketplaceModeration({ itemId: ID, kind: 'car', action: 'pause', reason: 'Policy review' }), {
    itemId: ID, kind: 'car', action: 'pause', reason: 'Policy review',
  });
  assert.equal(normalizeMarketplaceModeration({ itemId: ID, kind: 'car', action: 'reject', reason: 'Incomplete advert' }).action, 'reject');
  assert.throws(() => normalizeMarketplaceModeration({ itemId: ID, kind: 'car', action: 'remove', reason: '' }), /reason is required/);
  assert.throws(() => normalizeMarketplaceModeration({ itemId: 'not-an-id', kind: 'car', action: 'pause', reason: 'Policy review' }), /item id is invalid/i);
});

test('admin user filters reject dormant role concepts', () => {
  assert.equal(normalizeAdminUsersRequest({ role: 'admin', status: 'active' }).role, 'admin');
  assert.throws(() => normalizeAdminUsersRequest({ role: 'dealer' }), /role is invalid/);
});

test('role changes accept only the V1 user and admin roles', () => {
  assert.equal(normalizeUserRoleChange({ userId: ID, role: 'admin', reason: 'Operations access' }).role, 'admin');
  assert.throws(() => normalizeUserRoleChange({ userId: ID, role: 'lawyer', reason: 'No' }), /role is invalid/);
});

test('user enforcement validates status, reason, identity, and ban expiry', () => {
  const result = normalizeUserStatusChange({
    userId: ID,
    status: 'banned',
    reason: 'Confirmed scam activity',
    banUntil: '2030-01-01T00:00:00Z',
  });
  assert.equal(result.banUntil, '2030-01-01T00:00:00.000Z');
  assert.equal(normalizeUserStatusChange({ userId: ID, status: 'suspended', reason: 'Safety review' }).banUntil, null);
  assert.throws(() => normalizeUserStatusChange({ userId: ID, status: 'blocked', reason: 'No' }), /status is invalid/);
  assert.throws(() => normalizeUserStatusChange({ userId: ID, status: 'banned', reason: 'Confirmed abuse', banUntil: 'invalid' }), /expiry is invalid/);
  assert.throws(() => normalizeUserStatusChange({ userId: 'invalid', status: 'suspended', reason: 'Safety review' }), /User id is invalid/);
});

test('report decisions require an auditable note', () => {
  assert.equal(normalizeReportDecision({ reportId: ID, status: 'dismissed', notes: 'No policy breach' }).status, 'dismissed');
  assert.throws(() => normalizeReportDecision({ reportId: ID, status: 'pending', notes: 'Wait' }), /decision is invalid/);
});

test('support inbox requests and resolutions remain narrowly bounded', () => {
  assert.deepEqual(normalizeAdminSupportRequestsRequest({
    query: ' FIT-123 ', status: 'resolved', category: 'safety', limit: 500, cursor: { at: '2026-07-27T09:00:00Z', id: ID },
  }), {
    query: 'FIT-123', status: 'resolved', category: 'safety', limit: 100, cursor: { at: '2026-07-27T09:00:00.000Z', id: ID },
  });
  assert.throws(() => normalizeAdminSupportRequestsRequest({ category: 'billing' }), /category is invalid/);
  assert.deepEqual(normalizeSupportResolution({ requestId: ID, note: 'Handled by phone' }), {
    requestId: ID, note: 'Handled by phone',
  });
  assert.throws(() => normalizeSupportResolution({ requestId: ID, note: '' }), /reason is required/);
});

test('Peek moderation uses a bounded priority cursor and explicit decision', () => {
  assert.deepEqual(normalizeAdminTourQueueRequest({
    query: ' engine ',
    status: 'failed',
    limit: 500,
    cursor: { reportedPriority: 4, failedPriority: 2, at: '2026-08-05T10:00:00Z', id: ID },
  }), {
    query: 'engine',
    status: 'failed',
    limit: 100,
    cursor: { reportedPriority: 4, failedPriority: 2, at: '2026-08-05T10:00:00.000Z', id: ID },
  });
  assert.deepEqual(normalizeAdminTourDecision({ tourId: ID, action: 'reject', reason: 'Private information visible' }), {
    tourId: ID,
    action: 'reject',
    reason: 'Private information visible',
  });
  assert.throws(() => normalizeAdminTourQueueRequest({ status: 'deleted' }), /Peek status is invalid/);
  assert.throws(() => normalizeAdminTourDecision({ tourId: ID, action: 'publish', reason: 'No' }), /Peek decision is invalid/);
});

test('category creation preserves a stable lowercase slug', () => {
  assert.deepEqual(normalizeCategoryCreate({
    parentId: ID,
    slug: 'solar_installers',
    displayLabel: 'Solar Installers',
    sortOrder: 5,
    reason: 'Approved service category',
  }), {
    parentId: ID,
    slug: 'solar_installers',
    displayLabel: 'Solar Installers',
    sortOrder: 5,
    reason: 'Approved service category',
  });
  assert.throws(() => normalizeCategoryCreate({ parentId: ID, slug: 'Bad Slug', displayLabel: 'Bad', reason: 'No' }), /slug is invalid/);
});

test('category updates cannot mutate identity fields', () => {
  const result = normalizeCategoryUpdate({
    categoryId: ID,
    displayLabel: 'Updated label',
    sortOrder: 12,
    isActive: false,
    reason: 'Vocabulary cleanup',
    slug: 'ignored_by_contract',
  });
  assert.deepEqual(Object.keys(result).sort(), ['categoryId', 'displayLabel', 'isActive', 'reason', 'sortOrder'].sort());
});
