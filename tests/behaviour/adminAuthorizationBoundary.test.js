import { describe, expect, test } from 'vitest';
import {
  normalizeAdminHealthWindow,
  normalizeAdminId,
  normalizeAdminMarketplaceRequest,
  normalizeAdminReason,
  normalizeAdminUsersRequest,
  normalizeCategoryCreate,
  normalizeMarketplaceModeration,
  normalizeReportDecision,
  normalizeUserRoleChange,
  normalizeUserStatusChange,
} from '@/services/adminContracts';

// Admin mutations are the highest-privilege calls the browser can make. RLS and
// the protected RPCs are the real enforcement, but these contracts are what stop
// a malformed or hostile payload from ever reaching them, and what bound the
// pagination arguments so an admin screen cannot be turned into a bulk export.

const USER_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ITEM_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const REASON = 'Violates the prohibited items policy.';

describe('admin identifier validation', () => {
  test('accepts a well-formed uuid', () => {
    expect(normalizeAdminId(USER_ID)).toBe(USER_ID);
  });

  test.each([
    ['a sql fragment', "' OR 1=1--"],
    ['an empty string', ''],
    ['a number', 42],
    ['null', null],
    ['a uuid with a trailing fragment', `${USER_ID} OR 1=1`],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeAdminId(value)).toThrow(/is invalid/);
  });
});

describe('admin reason requirement', () => {
  test('accepts a substantive reason', () => {
    expect(normalizeAdminReason(REASON)).toBe(REASON);
  });

  test('rejects an empty reason so every privileged action stays attributable', () => {
    expect(() => normalizeAdminReason('   ')).toThrow(/Admin reason is required/);
  });

  test('rejects a reason below the minimum length', () => {
    expect(() => normalizeAdminReason('no')).toThrow(/Admin reason is required/);
  });

  test('rejects a reason over the storage ceiling', () => {
    expect(() => normalizeAdminReason('x'.repeat(1001))).toThrow(/Admin reason is too long/);
  });
});

describe('role escalation boundary', () => {
  test('allows promotion to admin with a reason', () => {
    expect(normalizeUserRoleChange({ userId: USER_ID, role: 'admin', reason: REASON }))
      .toEqual({ userId: USER_ID, role: 'admin', reason: REASON });
  });

  test('allows demotion to user', () => {
    expect(normalizeUserRoleChange({ userId: USER_ID, role: 'user', reason: REASON }).role)
      .toBe('user');
  });

  test.each(['superadmin', 'service_role', 'owner', 'ADMIN', 'all', ''])(
    'rejects the invented role %s',
    (role) => {
      expect(() => normalizeUserRoleChange({ userId: USER_ID, role, reason: REASON }))
        .toThrow(/User role is invalid/);
    },
  );

  test('refuses a role change with no reason even when the role is valid', () => {
    expect(() => normalizeUserRoleChange({ userId: USER_ID, role: 'admin' }))
      .toThrow(/Admin reason is required/);
  });

  test('"all" is a filter value and must never be accepted as a role assignment', () => {
    // normalizeAdminUsersRequest accepts 'all'; the mutation contract must not.
    expect(normalizeAdminUsersRequest({ role: 'all' }).role).toBe('all');
    expect(() => normalizeUserRoleChange({ userId: USER_ID, role: 'all', reason: REASON }))
      .toThrow(/User role is invalid/);
  });
});

describe('user status changes', () => {
  test('normalises a ban expiry to ISO-8601', () => {
    const result = normalizeUserStatusChange({
      userId: USER_ID,
      status: 'banned',
      reason: REASON,
      banUntil: '2027-01-01T00:00:00Z',
    });

    expect(result.banUntil).toBe('2027-01-01T00:00:00.000Z');
  });

  test('ignores a ban expiry when the status is not a ban', () => {
    const result = normalizeUserStatusChange({
      userId: USER_ID,
      status: 'suspended',
      reason: REASON,
      banUntil: '2027-01-01T00:00:00Z',
    });

    expect(result.banUntil).toBeNull();
  });

  test('rejects an unparseable ban expiry rather than silently dropping it', () => {
    expect(() => normalizeUserStatusChange({
      userId: USER_ID,
      status: 'banned',
      reason: REASON,
      banUntil: 'whenever',
    })).toThrow(/Ban expiry is invalid/);
  });

  test('rejects a status outside the allowed set', () => {
    expect(() => normalizeUserStatusChange({ userId: USER_ID, status: 'deleted', reason: REASON }))
      .toThrow(/User status is invalid/);
  });
});

describe('marketplace moderation', () => {
  test('accepts a publish decision', () => {
    const result = normalizeMarketplaceModeration({
      itemId: ITEM_ID,
      kind: 'property',
      action: 'publish',
      reason: REASON,
    });

    expect(result).toEqual({ itemId: ITEM_ID, kind: 'property', action: 'publish', reason: REASON });
  });

  test.each(['delete', 'drop', 'purge', 'all'])('rejects the action %s', (action) => {
    expect(() => normalizeMarketplaceModeration({
      itemId: ITEM_ID, kind: 'property', action, reason: REASON,
    })).toThrow(/Moderation action is invalid/);
  });

  test('rejects "all" as a moderation target kind', () => {
    expect(() => normalizeMarketplaceModeration({
      itemId: ITEM_ID, kind: 'all', action: 'pause', reason: REASON,
    })).toThrow(/Marketplace kind is invalid/);
  });
});

describe('report decisions', () => {
  test('accepts the three terminal decisions', () => {
    for (const status of ['reviewed', 'dismissed', 'actioned']) {
      expect(normalizeReportDecision({ reportId: ITEM_ID, status, notes: REASON }).status)
        .toBe(status);
    }
  });

  test('rejects reopening a report to "pending" through the decision contract', () => {
    expect(() => normalizeReportDecision({ reportId: ITEM_ID, status: 'pending', notes: REASON }))
      .toThrow(/Report decision is invalid/);
  });
});

describe('admin pagination bounds', () => {
  test('clamps an oversized limit to 100 instead of honouring it', () => {
    expect(normalizeAdminUsersRequest({ limit: 100000 }).limit).toBe(100);
    expect(normalizeAdminMarketplaceRequest({ limit: 100000 }).limit).toBe(100);
  });

  test('clamps a zero or negative limit up to 1', () => {
    expect(normalizeAdminUsersRequest({ limit: 0 }).limit).toBe(1);
    expect(normalizeAdminUsersRequest({ limit: -5 }).limit).toBe(1);
  });

  test('applies the default limit when none is supplied', () => {
    expect(normalizeAdminUsersRequest({}).limit).toBe(25);
  });

  test('rejects a non-integer limit rather than truncating it', () => {
    expect(() => normalizeAdminUsersRequest({ limit: 12.5 })).toThrow(/Limit is invalid/);
  });

  test('rejects an over-long search query', () => {
    expect(() => normalizeAdminUsersRequest({ query: 'x'.repeat(101) }))
      .toThrow(/Search query is too long/);
  });

  test('normalises a valid cursor and rejects a malformed one', () => {
    const cursor = { at: '2026-01-01T00:00:00Z', id: ITEM_ID };
    expect(normalizeAdminUsersRequest({ cursor }).cursor)
      .toEqual({ at: '2026-01-01T00:00:00.000Z', id: ITEM_ID });

    expect(() => normalizeAdminUsersRequest({ cursor: { at: 'nope', id: ITEM_ID } }))
      .toThrow(/timestamp is invalid/);
    expect(() => normalizeAdminUsersRequest({ cursor: [] })).toThrow(/is invalid/);
  });
});

describe('category management', () => {
  test('rejects a category slug that is not lowercase snake_case', () => {
    expect(() => normalizeCategoryCreate({ slug: 'Real Estate', name: 'Real Estate', kind: 'property' }))
      .toThrow();
  });
});

describe('admin health window', () => {
  test('accepts the documented default', () => {
    expect(normalizeAdminHealthWindow()).toBe(24);
  });

  test('rejects an unbounded window', () => {
    expect(() => normalizeAdminHealthWindow(100000)).toThrow(/is invalid/);
  });
});
