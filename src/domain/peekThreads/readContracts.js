const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PEEK_THREAD_FILTERS = Object.freeze(['all', 'answered', 'pending']);
export const PEEK_THREAD_SORTS = Object.freeze(['most_wanted', 'newest']);
export const PEEK_THREAD_PAGE_SIZE = 20;
export const PEEK_THREAD_MAX_PAGE_SIZE = 50;

function normalizeUuid(value, field) {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) throw new TypeError(`${field} must be a valid UUID`);
  return normalized;
}

export function normalizePeekThreadReadRequest(input = {}) {
  const parentType = input.parentType === 'service' ? 'service' : 'listing';
  const filter = PEEK_THREAD_FILTERS.includes(input.filter) ? input.filter : 'all';
  const sort = PEEK_THREAD_SORTS.includes(input.sort) ? input.sort : 'most_wanted';
  const requestedLimit = Number(input.limit ?? PEEK_THREAD_PAGE_SIZE);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : PEEK_THREAD_PAGE_SIZE, 1), PEEK_THREAD_MAX_PAGE_SIZE);
  const cursor = input.cursor
    ? {
        supporterCount: Math.max(0, Math.trunc(Number(input.cursor.supporterCount) || 0)),
        createdAt: new Date(input.cursor.createdAt).toISOString(),
        id: normalizeUuid(input.cursor.id, 'cursor.id'),
      }
    : null;

  return {
    parentType,
    parentId: normalizeUuid(input.parentId, 'parentId'),
    filter,
    sort,
    limit,
    cursor,
  };
}

export function normalizePeekThreadPage(rows = [], limit = PEEK_THREAD_PAGE_SIZE) {
  const items = rows.slice(0, limit).map((row) => ({
    requestId: row.request_id,
    parentType: row.listing_id ? 'listing' : 'service',
    parentId: row.listing_id ?? row.service_id,
    category: row.category,
    body: row.body,
    status: row.status,
    supporterCount: Number(row.supporter_count) || 0,
    requestedByLabel: row.requested_by_label || 'a buyer',
    requestedByMe: Boolean(row.requested_by_me),
    supportedByMe: Boolean(row.supported_by_me),
    createdAt: row.created_at,
    answeredAt: row.answered_at ?? null,
    currentResponseId: row.current_response_id ?? null,
  }));
  const cursorSource = rows[0];
  const nextCursor = cursorSource?.next_id
    ? {
        supporterCount: Number(cursorSource.next_supporter_count) || 0,
        createdAt: cursorSource.next_created_at,
        id: cursorSource.next_id,
      }
    : null;
  return { items, nextCursor };
}