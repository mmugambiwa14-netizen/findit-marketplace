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

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

export async function getNotifications(input = {}, signal) {
  const request = normalizeNotificationRequest(input);
  const rows = await findNotifications(request, signal);
  throwIfAborted(signal);
  return {
    items: (rows ?? []).map(normalizeNotificationRow),
    total: Number(rows?.[0]?.total_count ?? 0),
    limit: request.limit,
    offset: request.offset,
  };
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
