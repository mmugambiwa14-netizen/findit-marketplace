const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PEEK_ACTIVITY_PAGE_SIZE = 20;
export const PEEK_ACTIVITY_MAX_PAGE_SIZE = 50;

function normalizeUuid(value, field) {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) throw new TypeError(`${field} must be a valid UUID`);
  return normalized;
}

export function normalizePeekActivityRequest(input = {}) {
  const requestedLimit = Number(input.limit ?? PEEK_ACTIVITY_PAGE_SIZE);
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : PEEK_ACTIVITY_PAGE_SIZE, 1),
    PEEK_ACTIVITY_MAX_PAGE_SIZE,
  );
  const cursor = input.cursor
    ? {
        createdAt: new Date(input.cursor.createdAt).toISOString(),
        id: normalizeUuid(input.cursor.id, 'cursor.id'),
      }
    : null;
  return { limit, cursor };
}

export function normalizePeekActivityPage(rows = [], limit = PEEK_ACTIVITY_PAGE_SIZE) {
  const items = rows.slice(0, limit).map((row) => ({
    requestId: row.request_id,
    parentType: row.parent_type,
    parentId: row.parent_id,
    parentKind: row.parent_kind,
    parentTitle: row.parent_title,
    parentPublic: Boolean(row.parent_public),
    category: row.category,
    body: row.body,
    status: row.status,
    supporterCount: Number(row.supporter_count) || 0,
    requestedByMe: Boolean(row.requested_by_me),
    supportedByMe: Boolean(row.supported_by_me),
    declineReason: row.decline_reason || null,
    createdAt: row.created_at,
    answeredAt: row.answered_at || null,
    currentResponseId: row.current_response_id || null,
  }));
  const cursorSource = rows[0];
  const nextCursor = cursorSource?.next_id
    ? { createdAt: cursorSource.next_created_at, id: cursorSource.next_id }
    : null;
  return { items, nextCursor };
}