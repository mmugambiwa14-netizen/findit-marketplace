import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNotificationId,
  normalizeNotificationRequest,
  normalizeNotificationRow,
} from '../src/services/notificationContracts.js';

const ID = '00000000-0000-4000-8000-000000000001';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const RESPONSE_ID = '22222222-2222-4222-8222-222222222222';

const baseRow = {
  notification_id: ID,
  event_type: 'account_status',
  title: 'Account restored',
  message: 'Your access has been restored.',
  is_read: false,
  created_at: '2026-07-21T00:00:00.000Z',
};

test('notification identity accepts only opaque UUIDs', () => {
  assert.equal(normalizeNotificationId(ID.toUpperCase()), ID);
  assert.throws(() => normalizeNotificationId('alert@example.test'), /invalid/);
});

test('notification requests expose only active essential event classes', () => {
  assert.deepEqual(normalizeNotificationRequest({ eventType: 'peek_request_answered', unreadOnly: 1, limit: 25, offset: 50 }), {
    eventType: 'peek_request_answered', unreadOnly: true, limit: 25, offset: 50,
  });
  assert.deepEqual(normalizeNotificationRequest({ eventType: 'peek_request_created' }), {
    eventType: 'peek_request_created', unreadOnly: false, limit: 50, offset: 0,
  });
  assert.throws(() => normalizeNotificationRequest({ eventType: 'price_drop' }), /filter is invalid/);
  assert.throws(() => normalizeNotificationRequest({ limit: 101 }), /limit is invalid/);
});

test('notification rows preserve bounded Peek Request and Response Peek deep links', () => {
  assert.equal(normalizeNotificationRow({ ...baseRow, link: '/profile' }).link, '/profile');
  assert.equal(
    normalizeNotificationRow({ ...baseRow, event_type: 'peek_request_created', link: '/peek-requests' }).link,
    '/peek-requests',
  );
  assert.equal(
    normalizeNotificationRow({ ...baseRow, event_type: 'peek_request_created', link: `/peek-requests?request=${REQUEST_ID}` }).link,
    `/peek-requests?request=${REQUEST_ID}`,
  );
  const responseLink = `/property/${REQUEST_ID}?responsePeek=${RESPONSE_ID}#peek-threads`;
  assert.equal(
    normalizeNotificationRow({ ...baseRow, event_type: 'peek_request_answered', link: responseLink }).link,
    responseLink,
  );
});

test('notification rows discard links outside the route allowlist', () => {
  assert.equal(normalizeNotificationRow({ ...baseRow, link: 'https://unsafe.example' }).link, null);
  assert.equal(normalizeNotificationRow({ ...baseRow, link: '/peek-requests?redirect=https://unsafe.example' }).link, null);
  assert.equal(normalizeNotificationRow({ ...baseRow, link: `/property/${REQUEST_ID}?responsePeek=not-a-uuid#peek-threads` }).link, null);
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
