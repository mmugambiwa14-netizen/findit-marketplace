import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConversationBlock,
  normalizeConversationReport,
  normalizeMessageBody,
  normalizeMessageInboxRequest,
  normalizeMessagingId,
} from '../src/services/messagingContracts.js';

const ID = '00000000-0000-4000-8000-000000000001';

test('message identity accepts only opaque UUIDs', () => {
  assert.equal(normalizeMessagingId(ID.toUpperCase()), ID);
  assert.throws(() => normalizeMessagingId('seller@example.test'), /invalid/);
});

test('plain-text messages are trimmed, bounded, and control-safe', () => {
  assert.equal(normalizeMessageBody('  Hello seller\nIs this available?  '), 'Hello seller\nIs this available?');
  assert.throws(() => normalizeMessageBody('   '), /between 1 and 2000/);
  assert.throws(() => normalizeMessageBody('a'.repeat(2001)), /between 1 and 2000/);
  assert.throws(() => normalizeMessageBody('bad\u0001text'), /unsupported/);
});

test('inbox requests are server-paginated and bounded', () => {
  assert.deepEqual(normalizeMessageInboxRequest({ query: '  Toyota   Hilux ', unreadOnly: 1, limit: 25, offset: 50 }), {
    query: 'Toyota Hilux', unreadOnly: true, limit: 25, offset: 50,
  });
  assert.throws(() => normalizeMessageInboxRequest({ limit: 101 }), /limit is invalid/);
});

test('conversation blocks use participant-scoped identifiers', () => {
  assert.deepEqual(normalizeConversationBlock({ conversationId: ID, blocked: true }), { conversationId: ID, blocked: true });
});

test('conversation reports use the V1 abuse vocabulary', () => {
  assert.deepEqual(normalizeConversationReport({ conversationId: ID, reason: 'scam', description: ' Asked for a deposit ' }), {
    conversationId: ID, reason: 'scam', description: 'Asked for a deposit',
  });
  assert.throws(() => normalizeConversationReport({ conversationId: ID, reason: 'dislike' }), /reason is invalid/);
});
