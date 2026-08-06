import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConversationBlock,
  normalizeConversationReport,
  normalizeMessageBody,
  normalizeMessageInboxPageRequest,
  normalizeMessageThreadPageRequest,
  normalizeMessagingId,
} from '../../src/services/messagingContracts.js';
import {
  normalizeProfileIdentity,
  normalizeProfileUpdate,
} from '../../src/services/profileContracts.js';

const CONVERSATION_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const MESSAGE_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

test('message identifiers reject malformed and injection-shaped values', () => {
  assert.equal(normalizeMessagingId(CONVERSATION_ID), CONVERSATION_ID);
  for (const value of ['', 'not-a-uuid', "' OR 1=1--", `${CONVERSATION_ID}/messages`, null]) {
    assert.throws(() => normalizeMessagingId(value), /is invalid/);
  }
});

test('message bodies are required, bounded and reject control characters', () => {
  assert.equal(normalizeMessageBody('  Hello there  '), 'Hello there');
  assert.throws(() => normalizeMessageBody('   '), /between 1 and 2000/);
  assert.throws(() => normalizeMessageBody('x'.repeat(2001)), /between 1 and 2000/);
  assert.throws(() => normalizeMessageBody(`hello\u0000world`), /unsupported characters/);
  assert.throws(() => normalizeMessageBody({ text: 'hello' }), /must be text/);
});

test('inbox and thread pagination remain bounded', () => {
  assert.deepEqual(normalizeMessageInboxPageRequest({ limit: 30 }), {
    query: '', unreadOnly: false, limit: 30, cursor: null,
  });
  assert.throws(() => normalizeMessageInboxPageRequest({ limit: 5000 }), /limit is invalid/);
  assert.throws(() => normalizeMessageThreadPageRequest(CONVERSATION_ID, { limit: 0 }), /limit is invalid/);
  assert.throws(() => normalizeMessageThreadPageRequest(CONVERSATION_ID, {
    cursor: { at: 'not-a-date', id: MESSAGE_ID },
  }), /timestamp is invalid/);
});

test('block and report actions accept only documented inputs', () => {
  assert.deepEqual(normalizeConversationBlock({ conversationId: CONVERSATION_ID, blocked: true }), {
    conversationId: CONVERSATION_ID,
    blocked: true,
  });
  assert.throws(() => normalizeConversationReport({
    conversationId: CONVERSATION_ID,
    reason: 'delete_user',
  }), /reason is invalid/);
  assert.throws(() => normalizeConversationReport({
    conversationId: CONVERSATION_ID,
    reason: 'spam',
    description: 'x'.repeat(501),
  }), /too long/);
});

test('profile identity and updates accept only supported bounded fields', () => {
  assert.equal(normalizeProfileIdentity(' user-id '), 'user-id');
  assert.throws(() => normalizeProfileIdentity('   '), /required/);
  assert.deepEqual(normalizeProfileUpdate({ full_name: '  Ada Lovelace  ', bio: '  Builder  ' }), {
    full_name: 'Ada Lovelace',
    bio: 'Builder',
  });
  assert.throws(() => normalizeProfileUpdate({ role: 'admin' }), /No supported profile fields/);
  assert.throws(() => normalizeProfileUpdate({ full_name: '' }), /Full name is required/);
  assert.throws(() => normalizeProfileUpdate({ bio: 'x'.repeat(501) }), /Bio is too long/);
  assert.throws(() => normalizeProfileUpdate(null), /Profile update is required/);
});
