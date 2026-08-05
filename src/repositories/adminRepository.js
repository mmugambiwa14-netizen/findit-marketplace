import { supabase } from '@/lib/supabaseClient';

function adminError(message, error) {
  const correlationId = crypto.randomUUID();
  const failure = new Error(message);
  failure.name = 'AdminOperationError';
  failure.code = error?.code || 'ADMIN_OPERATION_FAILED';
  failure.correlationId = correlationId;
  failure.retryable = ['57014', '53300', '57P01', '08000', '08003', '08006'].includes(error?.code);
  failure.cause = error;
  console.error(`[admin:${correlationId}] ${message}`, { code: error?.code, details: error?.details, hint: error?.hint });
  return failure;
}

async function rpc(name, parameters, message) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw adminError(message, error);
  return data;
}

export function fetchAdminDashboardStats() { return rpc('admin_dashboard_stats', {}, 'We could not load the admin overview.'); }
export function fetchAdminMarketplace(request) { return rpc('admin_marketplace_rows_page', { p_query: request.query, p_kind: request.kind, p_status: request.status, p_limit: request.limit, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load marketplace records.'); }
export function mutateAdminMarketplace(input) { return rpc('admin_moderate_marketplace_item', { p_item_id: input.itemId, p_kind: input.kind, p_action: input.action, p_reason: input.reason }, 'The marketplace action could not be completed.'); }
export function fetchAdminUsers(request) { return rpc('admin_user_rows_page', { p_query: request.query, p_role: request.role, p_status: request.status, p_limit: request.limit, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load users.'); }
export function mutateAdminUserRole(input) { return rpc('admin_set_user_role', { p_user_id: input.userId, p_role: input.role, p_reason: input.reason }, 'Administrator role delegation is not available.'); }
export function mutateAdminUserStatus(input) { return rpc('admin_set_user_status', { p_user_id: input.userId, p_status: input.status, p_reason: input.reason, p_ban_until: input.banUntil }, 'The account status could not be changed.'); }
export function fetchAdminReports(request) { return rpc('admin_report_rows_page', { p_query: request.query, p_status: request.status, p_kind: request.kind, p_limit: request.limit, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load reports.'); }
export function mutateAdminReport(input) { return rpc('admin_review_report', { p_report_id: input.reportId, p_status: input.status, p_notes: input.notes }, 'The report decision could not be saved.'); }
export function fetchAdminSupportRequests(request) { return rpc('admin_support_request_rows_page', { p_query: request.query, p_status: request.status, p_category: request.category, p_limit: request.limit, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load support requests.'); }
export function mutateAdminSupportRequest(input) { return rpc('admin_resolve_support_request', { p_request_id: input.requestId, p_note: input.note }, 'The support request could not be resolved.'); }
export function fetchAdminTourQueue(request) { return rpc('admin_tour_queue_page', { p_query: request.query, p_status: request.status, p_limit: request.limit, p_cursor_reported_priority: request.cursor?.reportedPriority ?? null, p_cursor_failed_priority: request.cursor?.failedPriority ?? null, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load the Peek moderation queue.'); }
export function fetchAdminTourReviewMetadata(tourId) { return rpc('admin_tour_review_metadata', { p_tour_id: tourId }, 'We could not load this Peek for review.'); }
export function mutateAdminTour(input) { return rpc(input.action === 'approve' ? 'admin_approve_tour' : 'admin_reject_tour', { p_tour_id: input.tourId, p_reason: input.reason }, 'The Peek moderation decision could not be completed.'); }
export function fetchAdminAuditLog(request) { return rpc('admin_audit_rows_page', { p_query: request.query, p_target_type: request.targetType, p_limit: request.limit, p_cursor_at: request.cursor?.at ?? null, p_cursor_id: request.cursor?.id ?? null }, 'We could not load the audit log.'); }
export function fetchAdminCategories() { return rpc('admin_category_rows', {}, 'We could not load categories.'); }
export function insertAdminCategory(input) { return rpc('admin_add_category', { p_parent_id: input.parentId, p_slug: input.slug, p_display_label: input.displayLabel, p_sort_order: input.sortOrder, p_reason: input.reason }, 'The category could not be added.'); }
export function mutateAdminCategory(input) { return rpc('admin_update_category', { p_category_id: input.categoryId, p_display_label: input.displayLabel, p_sort_order: input.sortOrder, p_is_active: input.isActive, p_reason: input.reason }, 'The category could not be updated.'); }
export function fetchAdminOperationalHealth(hours) { return rpc('admin_operational_health', { p_hours: hours }, 'We could not load operational health.'); }
export function fetchAdminNotificationFanoutHealth() { return rpc('admin_notification_fanout_health', {}, 'We could not load notification delivery health.'); }
export function fetchAdminRecommendationAnalytics(startDate, endDate) { return rpc('admin_recommendation_analytics_v1', { p_start_date: startDate, p_end_date: endDate }, 'We could not load recommendation analytics.'); }
