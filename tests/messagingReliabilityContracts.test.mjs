import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [inbox, realtimeThread, thread, unreadHook, scaleSmoke] = await Promise.all([
  read('src/pages/Inquiries.jsx'),
  read('src/components/messaging/RealtimeConversationThread.jsx'),
  read('src/components/messaging/ConversationThread.jsx'),
  read('src/hooks/useUnreadMessages.js'),
  read('scripts/messaging-scale-smoke-local.mjs'),
]);

test('active inbox refreshes in the foreground and catches focus or reconnect events', () => {
  assert.match(inbox, /const INBOX_REFRESH_MS = 10_000/);
  assert.match(inbox, /refetchInterval:\s*INBOX_REFRESH_MS/);
  assert.match(inbox, /refetchIntervalInBackground:\s*false/);
  assert.match(inbox, /refetchOnWindowFocus:\s*'always'/);
  assert.match(inbox, /refetchOnReconnect:\s*'always'/);
  assert.match(inbox, /PeekaListing inbox/);
  assert.doesNotMatch(inbox, /FindIt inbox/);
});

test('open threads refresh remote metadata even when no new message is inserted', () => {
  assert.match(realtimeThread, /const METADATA_REFRESH_MS = 15_000/);
  assert.match(realtimeThread, /const refreshMetadata = \(\) =>/);
  assert.match(realtimeThread, /message-conversation-metadata/);
  assert.match(realtimeThread, /window\.setInterval/);
  assert.match(realtimeThread, /document\.visibilityState === 'visible'/);
  assert.match(realtimeThread, /window\.clearInterval\(metadataInterval\)/);
  assert.match(realtimeThread, /window\.addEventListener\('online', refreshAll\)/);
  assert.match(realtimeThread, /document\.addEventListener\('visibilitychange', refreshWhenVisible\)/);
});

test('message delivery retains realtime plus bounded foreground polling fallback', () => {
  assert.match(thread, /const ACTIVE_THREAD_REFRESH_MS = 4000/);
  assert.match(thread, /refetchInterval:\s*ACTIVE_THREAD_REFRESH_MS/);
  assert.match(thread, /refetchIntervalInBackground:\s*false/);
  assert.match(thread, /refetchOnWindowFocus:\s*'always'/);
  assert.match(thread, /refetchOnReconnect:\s*'always'/);
  assert.match(thread, /markConversationSeen\(conversationId\)/);
  assert.match(thread, /resetQueries\(\{ queryKey: \['message-thread', conversationId\], exact: true \}\)/);
  assert.match(realtimeThread, /table:\s*'inquiries'/);
  assert.match(realtimeThread, /event:\s*'INSERT'/);
});

test('global unread count refreshes after focus and reconnect without background polling', () => {
  assert.match(unreadHook, /refetchInterval:\s*30_000/);
  assert.match(unreadHook, /refetchIntervalInBackground:\s*false/);
  assert.match(unreadHook, /refetchOnWindowFocus:\s*'always'/);
  assert.match(unreadHook, /refetchOnReconnect:\s*'always'/);
});

test('messaging scale smoke keeps inbox and thread traversal bounded and participant-scoped', () => {
  assert.match(scaleSmoke, /p_limit:\s*30/);
  assert.match(scaleSmoke, /p_limit:\s*40/);
  assert.match(scaleSmoke, /inbox keyset pages contain no duplicates/);
  assert.match(scaleSmoke, /thread keyset pages contain no duplicates/);
  assert.match(scaleSmoke, /non-participants cannot page a thread/);
});
