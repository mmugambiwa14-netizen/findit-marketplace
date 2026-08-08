import { supabase } from '@/lib/supabaseClient';

async function rpc(name, parameters, message, signal) {
  let query = supabase.rpc(name, parameters);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) {
    const failure = new Error(message);
    failure.cause = error;
    throw failure;
  }
  return data;
}

export function findNotifications(request, signal) {
  return rpc('notification_rows', {
    p_event_type: request.eventType,
    p_unread_only: request.unreadOnly,
    p_limit: request.limit,
    p_offset: request.offset,
  }, 'Unable to load notifications', signal);
}

export function findNotificationsPage(request, signal) {
  return rpc('notification_rows_page', {
    p_event_type: request.eventType,
    p_unread_only: request.unreadOnly,
    p_cursor_at: request.cursor?.createdAt ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  }, 'Unable to load notifications', signal);
}

export function fetchUnreadNotificationCount(signal) {
  return rpc('notification_unread_count', {}, 'Unable to load notification count', signal);
}

export function updateNotificationRead(notificationId) {
  return rpc('mark_notification_read', {
    p_notification_id: notificationId,
  }, 'Unable to mark the notification as read');
}

export function updateAllNotificationsRead() {
  return rpc('mark_all_notifications_read', {}, 'Unable to mark notifications as read');
}
