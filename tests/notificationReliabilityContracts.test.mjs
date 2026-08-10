import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [center, unreadHook, contracts, migration, rollback, certification] = await Promise.all([
  read('src/pages/NotificationCenter.jsx'),
  read('src/hooks/useUnreadAlerts.js'),
  read('src/services/notificationContracts.js'),
  read('supabase/migrations/20260808040000_notification_peek_request_delivery_alignment.sql'),
  read('supabase/rollback/20260808040000_notification_peek_request_delivery_alignment.rollback.sql'),
  read('scripts/run-migration-database-certification.sh'),
]);

test('active notification contract recognizes seller demand and answered Peek Requests', () => {
  assert.match(contracts, /'peek_request_created'/);
  assert.match(contracts, /'peek_request_answered'/);
  assert.match(center, /peek_request_created: \{ label: 'New Peek Request'/);
  assert.match(center, /peek_request_answered: \{ label: 'Peek Request answered'/);
});

test('notification deep links remain same-origin and support the active Peek Request journeys', () => {
  assert.match(migration, /'\/peek-requests'/);
  assert.match(migration, /peek-requests\\\?request=/);
  assert.match(migration, /responsePeek=/);
  assert.match(migration, /#peek-threads/);
  assert.match(contracts, /peek-requests/);
  assert.match(contracts, /responsePeek=/);
  assert.doesNotMatch(migration, /https?:\/\//);
});

test('notification center and global unread badge recover on a bounded foreground cadence', () => {
  assert.match(center, /const NOTIFICATION_REFRESH_MS = 30_000/);
  assert.match(center, /refetchIntervalInBackground: false/);
  assert.match(center, /refetchOnWindowFocus: 'always'/);
  assert.match(center, /refetchOnReconnect: 'always'/);
  assert.match(unreadHook, /const UNREAD_REFRESH_MS = 30_000/);
  assert.match(unreadHook, /refetchIntervalInBackground: false/);
  assert.match(unreadHook, /refetchOnWindowFocus: "always"/);
  assert.match(unreadHook, /refetchOnReconnect: "always"/);
});

test('notification center uses current PeekaListing product language and coverage', () => {
  assert.match(center, /Messages, Peek activity, listing changes, business updates and important account notices will appear here\./);
  assert.match(center, /Important messages and marketplace updates/);
  assert.doesNotMatch(center, /FindIt only sends essential/);
});

test('notification route expansion is reversible and clean-database certified', () => {
  assert.match(rollback, /create or replace function public\.is_safe_notification_link/);
  assert.doesNotMatch(rollback, /drop function/);
  assert.match(certification, /v1_notification_peek_request_delivery\.sql/);
});
