const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_REASONS = new Set(['spam', 'scam', 'harassment', 'unsafe', 'other']);

export function normalizeMessagingId(value, label = 'Conversation') {
  if (typeof value !== 'string' || !UUID.test(value.trim())) {
    throw new TypeError(`${label} is invalid`);
  }
  return value.trim().toLowerCase();
}

export function normalizeMessageBody(value) {
  if (typeof value !== 'string') throw new TypeError('Message must be text');
  const body = value.trim();
  if (body.length < 1 || body.length > 2000) {
    throw new RangeError('Message must contain between 1 and 2000 characters');
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) {
    throw new TypeError('Message contains unsupported characters');
  }
  return body;
}

export function normalizeMessageInboxRequest(input = {}) {
  const query = typeof input.query === 'string' ? input.query.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  const limit = Number(input.limit ?? 50);
  const offset = Number(input.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Inbox limit is invalid');
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) throw new TypeError('Inbox offset is invalid');
  return { query, unreadOnly: Boolean(input.unreadOnly), limit, offset };
}

export function normalizeConversationBlock(input) {
  return {
    conversationId: normalizeMessagingId(input?.conversationId),
    blocked: Boolean(input?.blocked),
  };
}

export function normalizeConversationReport(input) {
  const reason = input?.reason;
  if (!REPORT_REASONS.has(reason)) throw new TypeError('Report reason is invalid');
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (description.length > 500) throw new RangeError('Report details are too long');
  return {
    conversationId: normalizeMessagingId(input?.conversationId),
    reason,
    description: description || null,
  };
}

export function normalizeMessagingCursor(value, label = 'Cursor') {
  if (value == null) return null;
  if (typeof value !== 'object') throw new TypeError(`${label} is invalid`);
  const timestamp = new Date(value.at);
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError(`${label} timestamp is invalid`);
  return {
    at: timestamp.toISOString(),
    id: normalizeMessagingId(value.id, `${label} id`),
  };
}

export function normalizeMessageInboxPageRequest(input = {}) {
  const query = typeof input.query === 'string' ? input.query.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  const limit = Number(input.limit ?? 30);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Inbox page limit is invalid');
  return {
    query,
    unreadOnly: Boolean(input.unreadOnly),
    limit,
    cursor: normalizeMessagingCursor(input.cursor, 'Inbox cursor'),
  };
}

export function normalizeMessageThreadPageRequest(conversationId, input = {}) {
  const limit = Number(input.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Thread page limit is invalid');
  return {
    conversationId: normalizeMessagingId(conversationId),
    limit,
    cursor: normalizeMessagingCursor(input.cursor, 'Message cursor'),
  };
}
