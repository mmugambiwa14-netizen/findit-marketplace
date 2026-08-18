import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [dialog, thread] = await Promise.all([
  readFile(new URL('../src/components/listings/MessageDialog.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/messaging/ConversationThread.jsx', import.meta.url), 'utf8'),
]);

test('listing message dialog submits the exact trimmed body through a real form', () => {
  assert.match(dialog, /mutationFn: \(body\) => startListingConversation\(listing\.id, body\)/);
  assert.match(dialog, /const body = message\.trim\(\)/);
  assert.match(dialog, /mutation\.mutate\(body\)/);
  assert.match(dialog, /<form onSubmit=\{submitMessage\}/);
  assert.match(dialog, /<Button type="button" onClick=\{submitMessage\}/);
  assert.match(dialog, /role="alert"/);
});

test('conversation thread submit is form-backed and keeps Enter-to-send consistent with the button', () => {
  assert.match(thread, /mutationFn: \(body\) => sendConversationMessage\(conversationId, body\)/);
  assert.match(thread, /const body = text\.trim\(\)/);
  assert.match(thread, /sendMutation\.mutate\(body\)/);
  assert.match(thread, /<form onSubmit=\{submitMessage\}/);
  assert.match(thread, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(thread, /<Button type="button" onClick=\{submitMessage\}[^>]*aria-label="Send message"/);
  assert.match(thread, /role="alert"/);
});
