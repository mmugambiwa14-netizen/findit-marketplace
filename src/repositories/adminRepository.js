import { supabase } from '@/lib/supabaseClient';

function repositoryError(message, error) {
  const failure = new Error(error?.message || message);
  failure.cause = error;
  return failure;
}

async function rpc(name, parameters, message) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw repositoryError(message, error);
  return data;
}

export function fetchAdminDashboardStats() {
  return rpc('admin_dashboard_stats', {}, 'Unable to load the admin overview');
}

export function fetchAdminMarketplace(request) {
  return rpc('admin_marketplace_rows_page', {
    p_query: request.query,
    p_kind: request.kind,
    p_status: request.status,
    p_limit: request.limit,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
  }, 'Unable to load marketplace records');
}

export function mutateAdminMarketplace(input) {
  return rpc('admin_moderate_marketplace_item', {
    p_item_id: input.itemId,
    p_kind: input.kind,
    p_action: input.action,
    p_reason: input.reason,
  }, 'Unable to moderate the marketplace item');
}

export function fetchAdminUsers(request) {
  return rpc('admin_user_rows_page', {
    p_query: request.query,
    p_role: request.role,
    p_status: request.status,
    p_limit: request.limit,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
  }, 'Unable to load users');
}

export function mutateAdminUserRole(input) {
  return rpc('admin_set_user_role', {
    p_user_id: input.userId,
    p_role: input.role,
    p_reason: input.reason,
  }, 'Unable to change the user role');
}

export function mutateAdminUserStatus(input) {
  return rpc('admin_set_user_status', {
    p_user_id: input.userId,
    p_status: input.status,
    p_reason: input.reason,
    p_ban_until: input.banUntil,
  }, 'Unable to change the user status');
}

export function fetchAdminReports(request) {
  return rpc('admin_report_rows_page', {
    p_query: request.query,
    p_status: request.status,
    p_kind: request.kind,
    p_limit: request.limit,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
  }, 'Unable to load reports');
}

export function mutateAdminReport(input) {
  return rpc('admin_review_report', {
    p_report_id: input.reportId,
    p_status: input.status,
    p_notes: input.notes,
  }, 'Unable to update the report');
}

export function fetchAdminSupportRequests(request) {
  return rpc('admin_support_request_rows_page', {
    p_query: request.query,
    p_status: request.status,
    p_category: request.category,
    p_limit: request.limit,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
  }, 'Unable to load support requests');
}

export function mutateAdminSupportRequest(input) {
  return rpc('admin_resolve_support_request', {
    p_request_id: input.requestId,
    p_note: input.note,
  }, 'Unable to resolve the support request');
}

export function fetchAdminAuditLog(request) {
  return rpc('admin_audit_rows_page', {
    p_query: request.query,
    p_target_type: request.targetType,
    p_limit: request.limit,
    p_cursor_at: request.cursor?.at ?? null,
    p_cursor_id: request.cursor?.id ?? null,
  }, 'Unable to load the audit log');
}

export function fetchAdminCategories() {
  return rpc('admin_category_rows', {}, 'Unable to load categories');
}

export function insertAdminCategory(input) {
  return rpc('admin_add_category', {
    p_parent_id: input.parentId,
    p_slug: input.slug,
    p_display_label: input.displayLabel,
    p_sort_order: input.sortOrder,
    p_reason: input.reason,
  }, 'Unable to add the category');
}

export function mutateAdminCategory(input) {
  return rpc('admin_update_category', {
    p_category_id: input.categoryId,
    p_display_label: input.displayLabel,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
    p_reason: input.reason,
  }, 'Unable to update the category');
}

export function fetchAdminOperationalHealth(hours) {
  return rpc('admin_operational_health', {
    p_hours: hours,
  }, 'Unable to load operational health');
}

export function fetchAdminNotificationFanoutHealth() {
  return rpc('admin_notification_fanout_health', {}, 'Unable to load notification fan-out health');
}

export function fetchAdminRecommendationAnalytics(startDate, endDate) {
  return rpc('admin_recommendation_analytics_v1', {
    p_start_date: startDate,
    p_end_date: endDate,
  }, 'Unable to load recommendation analytics');
}
