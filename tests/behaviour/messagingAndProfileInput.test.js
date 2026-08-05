import { describe, expect, test } from 'vitest';
import {
  normalizeConversationBlock,
  normalizeConversationReport,
  normalizeMessageBody,
  normalizeMessageInboxPageRequest,
  normalizeMessageInboxRequest,
  normalizeMessageThreadPageRequest,
  normalizeMessagingId,
} from '@/services/messagingContracts';
import { normalizeProfileIdentity, normalizeProfileUpdate } from '@/services/profileContracts';

// Messaging is the one place a user's free text is persisted and then shown to
// another user. Storage is plain text and React escapes on render, so the risk
// here is not markup -- it is control characters that corrupt the stored value
// and unbounded input that turns a thread into a denial-of-service.

const CONVERSATION = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('message body validation', () => {
  test('accepts ordinary prose unchanged apart from trimming', () => {
    expect(normalizeMessageBody('  Is this still available?  ')).toBe('Is this still available?');
  });

  test('preserves newlines and tabs, which are legitimate in a message', () => {
    expect(normalizeMessageBody('line one\nline two\tindented')).toBe('line one\nline two\tindented');
  });

  test('preserves non-ASCII text', () => {
    // Accented and extended Latin must survive: the guard below targets control
    // characters only, and must not become a general non-ASCII filter.
    const body = 'Ndinoda kutenga imba iyi — tinombobvunza mutengesi (não é urgente)';
    expect(normalizeMessageBody(body)).toBe(body);
  });

  test.each([
    ['a NUL byte', 'hello\u0000world'],
    ['a backspace', 'hello\u0008world'],
    ['an escape', 'hello\u001bworld'],
    ['a delete', 'hello\u007fworld'],
    ['a vertical tab', 'hello\u000bworld'],
    ['a form feed', 'hello\u000cworld'],
  ])('rejects %s', (_label, body) => {
    expect(() => normalizeMessageBody(body)).toThrow(/unsupported characters/);
  });

  test('rejects an empty or whitespace-only message', () => {
    expect(() => normalizeMessageBody('   ')).toThrow(/between 1 and 2000/);
  });

  test('rejects a message beyond the stored ceiling', () => {
    expect(() => normalizeMessageBody('x'.repeat(2001))).toThrow(/between 1 and 2000/);
  });

  test('accepts a message exactly at the ceiling', () => {
    expect(normalizeMessageBody('x'.repeat(2000))).toHaveLength(2000);
  });

  test('rejects a non-string body rather than coercing it', () => {
    expect(() => normalizeMessageBody({ toString: () => 'hi' })).toThrow(/must be text/);
    expect(() => normalizeMessageBody(null)).toThrow(/must be text/);
  });

  test('markup is stored verbatim; escaping is the renderer\'s job, not a silent rewrite', () => {
    const body = '<script>alert(1)</script>';
    expect(normalizeMessageBody(body)).toBe(body);
  });
});

describe('conversation identifiers', () => {
  test('lowercases so a cursor and a lookup agree', () => {
    expect(normalizeMessagingId(CONVERSATION.toUpperCase())).toBe(CONVERSATION);
  });

  test.each([
    ["a sql fragment", "' OR 1=1--"],
    ['an empty string', ''],
    ['a number', 1],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeMessagingId(value)).toThrow(/Conversation is invalid/);
  });
});

describe('inbox pagination bounds', () => {
  test('applies documented defaults', () => {
    expect(normalizeMessageInboxRequest({})).toEqual({
      query: '', unreadOnly: false, limit: 50, offset: 0,
    });
  });

  test('rejects rather than clamps an out-of-range limit', () => {
    expect(() => normalizeMessageInboxRequest({ limit: 101 })).toThrow(/Inbox limit is invalid/);
    expect(() => normalizeMessageInboxRequest({ limit: 0 })).toThrow(/Inbox limit is invalid/);
  });

  test('bounds the offset so the inbox cannot be walked indefinitely', () => {
    expect(() => normalizeMessageInboxRequest({ offset: 1_000_001 })).toThrow(/Inbox offset is invalid/);
    expect(() => normalizeMessageInboxRequest({ offset: -1 })).toThrow(/Inbox offset is invalid/);
  });

  test('collapses runs of whitespace in the search query', () => {
    expect(normalizeMessageInboxRequest({ query: '  three    bedroom   ' }).query)
      .toBe('three bedroom');
  });

  test('truncates an over-long search query', () => {
    expect(normalizeMessageInboxRequest({ query: 'x'.repeat(400) }).query).toHaveLength(100);
  });

  test('the keyset inbox page uses a tighter limit than the offset inbox', () => {
    expect(normalizeMessageInboxPageRequest({}).limit).toBe(30);
    expect(() => normalizeMessageInboxPageRequest({ limit: 51 })).toThrow(/Inbox page limit is invalid/);
  });

  test('a thread page validates its conversation and cursor together', () => {
    const request = normalizeMessageThreadPageRequest(CONVERSATION, {
      limit: 25,
      cursor: { at: '2026-01-01T00:00:00Z', id: CONVERSATION },
    });

    expect(request.conversationId).toBe(CONVERSATION);
    expect(request.cursor).toEqual({ at: '2026-01-01T00:00:00.000Z', id: CONVERSATION });
  });

  test('a thread page rejects a cursor with an unparseable timestamp', () => {
    expect(() => normalizeMessageThreadPageRequest(CONVERSATION, {
      cursor: { at: 'soon', id: CONVERSATION },
    })).toThrow(/timestamp is invalid/);
  });
});

describe('blocking and reporting', () => {
  test('block coerces the flag to a real boolean', () => {
    expect(normalizeConversationBlock({ conversationId: CONVERSATION, blocked: 'yes' }))
      .toEqual({ conversationId: CONVERSATION, blocked: true });
  });

  test('a report requires a reason from the allowed set', () => {
    expect(() => normalizeConversationReport({ conversationId: CONVERSATION, reason: 'because' }))
      .toThrow(/Report reason is invalid/);
  });

  test('an empty report description becomes null rather than an empty string', () => {
    expect(normalizeConversationReport({
      conversationId: CONVERSATION, reason: 'spam', description: '   ',
    }).description).toBeNull();
  });

  test('rejects an over-long report description', () => {
    expect(() => normalizeConversationReport({
      conversationId: CONVERSATION, reason: 'scam', description: 'x'.repeat(501),
    })).toThrow(/Report details are too long/);
  });
});

describe('profile updates', () => {
  test('trims a full name', () => {
    expect(normalizeProfileUpdate({ full_name: '  Tendai Moyo  ' }))
      .toEqual({ full_name: 'Tendai Moyo' });
  });

  test('an emptied bio becomes null so the column clears', () => {
    expect(normalizeProfileUpdate({ bio: '   ' })).toEqual({ bio: null });
  });

  test('rejects a blank full name rather than clearing the display name', () => {
    expect(() => normalizeProfileUpdate({ full_name: '   ' })).toThrow(/Full name is required/);
  });

  test('rejects an update containing no supported field, so no empty write is sent', () => {
    expect(() => normalizeProfileUpdate({ role: 'admin' }))
      .toThrow(/No supported profile fields/);
  });

  test('an attempt to set role through the profile update is silently dropped, not honoured', () => {
    expect(() => normalizeProfileUpdate({ role: 'admin', is_admin: true })).toThrow();
    expect(normalizeProfileUpdate({ full_name: 'Tendai', role: 'admin' }))
      .toEqual({ full_name: 'Tendai' });
  });

  test('rejects over-long values', () => {
    expect(() => normalizeProfileUpdate({ full_name: 'x'.repeat(121) })).toThrow(/too long/);
    expect(() => normalizeProfileUpdate({ bio: 'x'.repeat(501) })).toThrow(/too long/);
  });

  test('identity must be present', () => {
    expect(() => normalizeProfileIdentity('')).toThrow(/User is required/);
    expect(() => normalizeProfileIdentity(null)).toThrow(/User is required/);
  });
});
