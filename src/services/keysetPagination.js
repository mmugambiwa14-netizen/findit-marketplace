const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Pagination cursor timestamp is invalid');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError('Pagination cursor timestamp is invalid');
  }
  return parsed.toISOString();
}

export function normalizeKeysetCursor(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Pagination cursor is invalid');
  }
  const id = typeof value.id === 'string' ? value.id.trim().toLowerCase() : '';
  if (!UUID_PATTERN.test(id)) throw new TypeError('Pagination cursor ID is invalid');
  return {
    createdAt: normalizeTimestamp(value.createdAt),
    id,
  };
}

export function normalizePageLimit(value, { fallback = 24, maximum = 60 } = {}) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), maximum);
}

export function applyDescendingCreatedAtCursor(query, cursor) {
  if (!cursor) return query;
  return query.or(
    `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
  );
}

export function createKeysetPage(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const items = safeRows.slice(0, limit);
  const hasNextPage = safeRows.length > limit;
  const last = hasNextPage ? items.at(-1) : null;
  return {
    items,
    nextCursor: last ? { createdAt: last.created_at, id: last.id } : null,
  };
}
