import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL(
  '../supabase/migrations/20260818153000_message_notification_event_alignment.sql',
  import.meta.url,
), 'utf8');
const constraintMigration = await readFile(new URL(
  '../supabase/migrations/20260818154500_message_notification_event_constraint.sql',
  import.meta.url,
), 'utf8');

test('message notifications persist the canonical new_message event', () => {
  assert.match(migration, /when p_event_type = 'message_received' then 'new_message'/);
  assert.match(migration, /'managed_listing_updated', 'new_message'/);
  assert.match(migration, /normalized_event, normalized_source/);
});

test('the obsolete inquiry notification trigger is removed and one idempotent path remains', () => {
  assert.match(migration, /drop trigger if exists inquiries_notify_recipient on public\.inquiries/i);
  assert.match(migration, /drop trigger if exists inquiries_enqueue_message_notification on public\.inquiries/i);
  assert.match(migration, /create trigger inquiries_enqueue_message_notification[\s\S]*?execute function public\.enqueue_message_notification\(\)/i);
  assert.match(migration, /on conflict \(user_id, event_type, source_key\)/i);
});

test('the cursor notification RPC accepts new_message', () => {
  const cursorStart = migration.indexOf('create or replace function private.notification_rows_page(');
  assert.notEqual(cursorStart, -1);
  const cursorDefinition = migration.slice(cursorStart);
  assert.match(cursorDefinition, /'managed_listing_updated','new_message'/);
  assert.doesNotMatch(cursorDefinition, /message_received/);
});

test('app_alerts accepts the canonical message event without invalidating the legacy alias', () => {
  assert.match(constraintMigration, /drop constraint if exists app_alerts_v1_event_type_check/i);
  assert.match(constraintMigration, /'managed_listing_updated', 'new_message', 'message_received'/);
});
