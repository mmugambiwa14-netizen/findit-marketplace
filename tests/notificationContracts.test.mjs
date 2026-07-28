import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNotificationId,
  normalizeNotificationRequest,
  normalizeNotificationRow,
} from '../src/services/notificationContracts.js';

const ID = '00000000-0000-4000-8000-000000000001';

test('notification identity accepts only opaque UUIDs', () => {
  assert.equal(normalizeNotificationId(ID.toUpperCase()), ID);
  assert.throws(() => normalizeNotificationId('alert@example.test'), /invalid/);
});

test('notification requests expose only the five V1 event classes', () => {
  assert.deepEqual(normalizeNotificationRequest({ eventType: 'report_resolved', unreadOnly: 1, limit: 25, offset: 50 }), {
    eventType: 'report_resolved', unreadOnly: true, limit: 25, offset: 50,
  });
  assert.throws(() => normalizeNotificationRequest({ eventType: 'price_drop' }), /filter is invalid/);
  assert.throws(() => normalizeNotificationRequest({ limit: 101 }), /limit is invalid/);
});

test('notification rows discard links outside the V1 route allowlist', () => {
  const base = {
    notification_id: ID,
    event_type: 'account_status',
    title: 'Account restored',
    message: 'Your access has been restored.',
    is_read: false,
    created_at: '2026-07-21T00:00:00.000Z',
  };
  assert.equal(normalizeNotificationRow({ ...base, link: '/profile' }).link, '/profile');
  assert.equal(normalizeNotificationRow({ ...base, link: 'https://unsafe.example' }).link, null);
});

test('legacy and marketing alert classes cannot enter the active V1 contract', () => {
  assert.throws(() => normalizeNotificationRow({
    notification_id: ID,
    event_type: 'price_drop',
    title: 'Price drop',
    message: 'Marketing alert',
    created_at: '2026-07-21T00:00:00.000Z',
  }), /Unsupported/);
});
