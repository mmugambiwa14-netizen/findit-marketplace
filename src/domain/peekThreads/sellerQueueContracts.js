const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSellerPeekQueueRequest(input = {}) {
  const requestedLimit = Number(input.limit ?? 20);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 20, 1), 50);
  const cursor = input.cursor
    ? {
        score: Math.max(0, Math.trunc(Number(input.cursor.score) || 0)),
        createdAt: new Date(input.cursor.createdAt).toISOString(),
        id: String(input.cursor.id || '').trim(),
      }
    : null;
  if (cursor && !UUID_PATTERN.test(cursor.id)) throw new TypeError('cursor.id must be a valid UUID');
  return { limit, cursor };
}

export function normalizeSellerPeekQueuePage(rows = [], limit = 20) {
  const items = rows.slice(0, limit).map((row) => ({
    requestId: row.request_id,
    parentType: row.parent_type,
    parentId: row.listing_id ?? row.service_id,
    parentKind: row.parent_kind,
    parentTitle: row.parent_title,
    category: row.category,
    body: row.body,
    supporterCount: Number(row.supporter_count) || 0,
    createdAt: row.created_at,
    pendingSeconds: Number(row.pending_seconds) || 0,
    queueScore: Number(row.queue_score) || 0,
  }));
  const source = rows[0];
  return {
    items,
    nextCursor: source?.next_id
      ? { score: Number(source.next_score) || 0, createdAt: source.next_created_at, id: source.next_id }
      : null,
  };
}
