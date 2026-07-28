import {
  fetchUnreadNotificationCount,
  findNotifications,
  findNotificationsPage,
  updateAllNotificationsRead,
  updateNotificationRead,
} from '@/repositories/notificationsRepository';
import {
  normalizeNotificationId,
  normalizeNotificationPageRequest,
  normalizeNotificationRequest,
  normalizeNotificationRow,
} from '@/services/notificationContracts';

export async function getNotifications(input = {}) {
  const request = normalizeNotificationRequest(input);
  const rows = await findNotifications(request);
  return {
    items: (rows ?? []).map(normalizeNotificationRow),
    total: Number(rows?.[0]?.total_count ?? 0),
    limit: request.limit,
    offset: request.offset,
  };
}

export async function getNotificationsPage(input = {}) {
  const request = normalizeNotificationPageRequest(input);
  const rows = await findNotificationsPage(request);
  const hasMore = rows.length > request.limit;
  const pageRows = rows.slice(0, request.limit);
  const items = pageRows.map(normalizeNotificationRow);
  const last = items.at(-1);
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? { createdAt: last.created_date, id: last.id } : null,
  };
}

export async function getUnreadNotificationCount() {
  return Number(await fetchUnreadNotificationCount() ?? 0);
}

export function markNotificationRead(notificationId) {
  return updateNotificationRead(normalizeNotificationId(notificationId));
}

export function markAllNotificationsRead() {
  return updateAllNotificationsRead();
}
