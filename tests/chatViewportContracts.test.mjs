import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const thread = await readFile(new URL('../src/components/messaging/ConversationThread.jsx', import.meta.url), 'utf8');

test('conversation chrome stays pinned while only messages scroll', () => {
  assert.match(thread, /fixed inset-0 z-30 flex h-\[100dvh\] flex-col overflow-hidden/);
  assert.match(thread, /<header[\s\S]*safe-area-top/);
  assert.match(thread, /<main ref=\{scrollRef\} className="findit-scroll-region min-h-0 flex-1 overflow-y-auto/);
  assert.match(thread, /<footer className="shrink-0[^"]*pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);

  const headerIndex = thread.indexOf('<header');
  const messagesIndex = thread.indexOf('<main ref={scrollRef}');
  const composerIndex = thread.indexOf('<footer');
  assert.ok(headerIndex >= 0 && headerIndex < messagesIndex && messagesIndex < composerIndex);
});
