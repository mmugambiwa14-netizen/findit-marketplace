import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, repository, notificationTest] = await Promise.all([
  read('supabase/migrations/0098_private_notification_read_implementations.sql'),
  read('supabase/rollback/0098_private_notification_read_implementations.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/notificationsRepository.js'),
  read('supabase/tests/v1_essential_notifications.sql'),
]);

test('notification unread and read-state operations move behind three private implementations', () => {
  for (const name of ['notification_unread_count', 'mark_notification_read', 'mark_all_notifications_read']) {
    assert.match(migration, new RegExp(`alter function public\\.${name}`));
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`private\\.${name}`));
  }
  assert.match(migration, /ccffc075095c6507a45b500f8165f230/);
  assert.match(migration, /bb51925c94fba361f2b69e26471ac6ec/);
  assert.match(migration, /2086b0e85fdec8b3949a82f17d4a58c1/);
  assert.match(migration, /left a PUBLIC execute grant on a notification read function/);
  assert.match(migration, /exposed an authenticated notification RPC to anon/);
  assert.match(rollback, /did not restore all canonical notification implementations/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('notification wrappers preserve result types and volatility', () => {
  assert.match(migration, /create function public\.notification_unread_count\(\)[\s\S]*?returns bigint[\s\S]*?stable[\s\S]*?security invoker/);
  assert.match(migration, /create function public\.mark_notification_read\(p_notification_id uuid\)[\s\S]*?returns boolean[\s\S]*?volatile[\s\S]*?security invoker/);
  assert.match(migration, /create function public\.mark_all_notifications_read\(\)[\s\S]*?returns integer[\s\S]*?volatile[\s\S]*?security invoker/);
  assert.match(migration, /to authenticated,service_role/);
});

test('active notification repository preserves the exact three RPC calls and safe user messages', () => {
  assert.match(repository, /rpc\('notification_unread_count', \{\}, 'Unable to load notification count'\)/);
  assert.match(repository, /rpc\('mark_notification_read', \{/);
  assert.match(repository, /p_notification_id: notificationId/);
  assert.match(repository, /rpc\('mark_all_notifications_read', \{\}, 'Unable to mark notifications as read'\)/);
  assert.match(repository, /const failure = new Error\(message\)/);
  assert.doesNotMatch(repository, /new Error\(error\.message/);
});

test('existing notification certification proves ownership, transitions and cross-user isolation', () => {
  assert.match(notificationTest, /unread count is calculated at the server boundary/);
  // The F-070 rewrite routed this fixture through the real listing-submission
  // path, so the assertion now names the specific notification it marks. Bind to
  // the behaviour (owner marks a notification read via the trusted RPC) rather
  // than to the exact phrasing.
  assert.match(notificationTest, /an owner can mark .*notification read through the trusted RPC/);
  assert.match(notificationTest, /an owner can mark all remaining notifications read/);
  assert.match(notificationTest, /read-state changes update the unread count/);
  assert.match(notificationTest, /authenticated clients cannot forge notifications/);
  assert.match(notificationTest, /another active user cannot read someone else notifications/);
});

test('migration gates run the notification boundary and full notification matrices', () => {
  assert.match(workflow, /v1_private_notification_read_implementations\.sql/);
  assert.match(workflow, /v1_essential_notifications\.sql/);
  assert.match(sqlBoundary, /0098_private_notification_read_implementations\.sql/);
  assert.match(sqlBoundary, /0097_private_public_listing_search_implementation\.sql/);
});
