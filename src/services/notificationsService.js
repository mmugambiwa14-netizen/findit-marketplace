import {
  fetchUnreadNotificationCount,
  findNotificationsPage,
  updateAllNotificationsRead,
  updateNotificationRead,
} from '@/repositories/notificationsRepository';
import {
  normalizeNotificationId,
  normalizeNotificationPageRequest,
  normalizeNotificationRow,
} from '@/services/notificationContracts';

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

export async function getNotificationsPage(input = {}, signal) {
  const request = normalizeNotificationPageRequest(input);
  const response = await findNotificationsPage(request, signal);
  throwIfAborted(signal);
  const rows = Array.isArray(response) ? response : [];
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

export async function getUnreadNotificationCount(signal) {
  const value = await fetchUnreadNotificationCount(signal);
  throwIfAborted(signal);
  return Math.max(0, Number(value) || 0);
}

export function markNotificationRead(notificationId) {
  return updateNotificationRead(normalizeNotificationId(notificationId));
}

export function markAllNotificationsRead() {
  return updateAllNotificationsRead();
}
