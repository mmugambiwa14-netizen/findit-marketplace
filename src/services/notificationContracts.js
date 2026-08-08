const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_PART = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const EVENTS = new Set([
  'listing_approved',
  'listing_rejected',
  'listing_expires_soon',
  'report_resolved',
  'account_status',
  'tour_ready',
  'tour_failed',
  'tour_rejected',
  'listing_status_changed',
  'saved_listing_unavailable',
  'peek_request_created',
  'peek_request_answered',
]);
const SAFE_LINK = new RegExp(
  `^(?:/(?:my-listings|profile|settings|chats|saved|post|peek-requests)|/peek-requests\\?request=${UUID_PART}|/(?:chats|messages)/${UUID_PART}|/(?:property|car|machinery|service)/${UUID_PART}(?:\\?responsePeek=${UUID_PART})?(?:#peek-threads)?)$`,
  'i',
);

export function normalizeNotificationId(value) {
  if (typeof value !== 'string' || !UUID.test(value.trim())) {
    throw new TypeError('Notification is invalid');
  }
  return value.trim().toLowerCase();
}

function normalizeEventType(value) {
  const eventType = value ?? 'all';
  if (eventType !== 'all' && !EVENTS.has(eventType)) {
    throw new TypeError('Notification filter is invalid');
  }
  return eventType;
}

function normalizeLimit(value, maximum) {
  const limit = Number(value ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) {
    throw new TypeError('Notification limit is invalid');
  }
  return limit;
}

export function normalizeNotificationRequest(input = {}) {
  const offset = Number(input.offset ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new TypeError('Notification offset is invalid');
  }
  return {
    eventType: normalizeEventType(input.eventType),
    unreadOnly: Boolean(input.unreadOnly),
    limit: normalizeLimit(input.limit, 100),
    offset,
  };
}

export function normalizeNotificationPageRequest(input = {}) {
  let cursor = null;
  if (input.cursor !== null && input.cursor !== undefined) {
    if (!input.cursor || typeof input.cursor !== 'object' || Array.isArray(input.cursor)) {
      throw new TypeError('Notification cursor is invalid');
    }
    const id = normalizeNotificationId(input.cursor.id);
    const timestamp = Date.parse(input.cursor.createdAt);
    if (!Number.isFinite(timestamp)) throw new TypeError('Notification cursor is invalid');
    cursor = { id, createdAt: new Date(timestamp).toISOString() };
  }
  return {
    eventType: normalizeEventType(input.eventType),
    unreadOnly: Boolean(input.unreadOnly),
    limit: normalizeLimit(input.limit, 50),
    cursor,
  };
}

export function normalizeNotificationRow(row) {
  if (!row || !EVENTS.has(row.event_type)) {
    throw new TypeError('Unsupported notification event');
  }
  const id = normalizeNotificationId(row.notification_id);
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const message = typeof row.message === 'string' ? row.message.trim() : '';
  const createdAt = Date.parse(row.created_at);
  if (!title || !message || !Number.isFinite(createdAt)) {
    throw new TypeError('Notification content is incomplete');
  }
  return {
    id,
    event_type: row.event_type,
    title,
    message,
    link: typeof row.link === 'string' && SAFE_LINK.test(row.link) ? row.link : null,
    is_read: Boolean(row.is_read),
    read_at: row.read_at ?? null,
    listing_id: row.listing_id ?? null,
    created_date: new Date(createdAt).toISOString(),
  };
}
