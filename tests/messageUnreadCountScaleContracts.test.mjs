import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, repository, service, hook, messagingFoundation, certification] = await Promise.all([
  read('supabase/migrations/20260808060000_message_unread_count_projection.sql'),
  read('supabase/rollback/20260808060000_message_unread_count_projection.rollback.sql'),
  read('src/repositories/messagingRepository.js'),
  read('src/services/messagingService.js'),
  read('src/hooks/useUnreadMessages.js'),
  read('supabase/migrations/0018_v1_messaging.sql'),
  read('scripts/run-migration-database-certification.sh'),
]);

test('unread badge uses a private count-only implementation behind an invoker wrapper', () => {
  const privateStart = migration.indexOf('create or replace function private.message_unread_count()');
  const publicStart = migration.indexOf('create or replace function public.message_unread_count()');
  assert.notEqual(privateStart, -1);
  assert.notEqual(publicStart, -1);
  const privateBlock = migration.slice(privateStart, publicStart);
  const publicBlock = migration.slice(publicStart);

  assert.match(privateBlock, /returns bigint/);
  assert.match(privateBlock, /stable/);
  assert.match(privateBlock, /security definer/);
  assert.match(privateBlock, /set search_path = ''/);
  assert.match(publicBlock, /language sql/);
  assert.match(publicBlock, /security invoker/);
  assert.match(publicBlock, /set search_path = ''/);
  assert.match(publicBlock, /select private\.message_unread_count\(\)/);
  assert.match(publicBlock, /grant execute on function public\.message_unread_count\(\) to authenticated, service_role/);
  assert.doesNotMatch(publicBlock, /grant execute[^\n]+\bto anon\b/);
});

test('count projection stays on indexed conversation state and avoids inbox hydration joins', () => {
  const privateStart = migration.indexOf('create or replace function private.message_unread_count()');
  const publicStart = migration.indexOf('create or replace function public.message_unread_count()');
  const privateBlock = migration.slice(privateStart, publicStart);

  assert.match(privateBlock, /conversation\.buyer_id = current_user_id/);
  assert.match(privateBlock, /conversation\.seller_id = current_user_id/);
  assert.match(privateBlock, /buyer_last_seen_at/);
  assert.match(privateBlock, /seller_last_seen_at/);
  assert.match(privateBlock, /union all/i);
  assert.doesNotMatch(privateBlock, /public\.listings|public\.users|public\.inquiries|listing_tour/i);
  assert.match(messagingFoundation, /create index conversations_buyer_inbox\s+on public\.conversations\(buyer_id, last_message_at desc, id desc\)/);
  assert.match(messagingFoundation, /create index conversations_seller_inbox\s+on public\.conversations\(seller_id, last_message_at desc, id desc\)/);
});

test('global unread polling bypasses inbox rows, media hydration and accepts cancellation', () => {
  assert.match(repository, /export function findMessageUnreadCount\(signal\)/);
  assert.match(repository, /rpc\('message_unread_count', \{\}, 'Unable to load unread message count', signal\)/);
  assert.match(service, /export async function getUnreadMessageCount\(signal\)/);
  assert.match(service, /await findMessageUnreadCount\(signal\)/);
  assert.match(service, /throwIfAborted\(signal\)/);
  assert.match(hook, /getUnreadMessageCount/);
  assert.match(hook, /queryFn: \(\{ signal \}\) => getUnreadMessageCount\(signal\)/);
  assert.doesNotMatch(hook, /getMessageInbox|hydrateListingCardImages|listing_photo|limit:\s*1|unreadOnly/);
});

test('unread count has targeted rollback and clean-database certification', () => {
  assert.match(rollback, /drop function if exists public\.message_unread_count\(\)/);
  assert.match(rollback, /drop function if exists private\.message_unread_count\(\)/);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
  assert.match(certification, /v1_message_unread_count_projection\.sql/);
});
