import {
  fetchAdminAuditLog,
  fetchAdminCategories,
  fetchAdminDashboardStats,
  fetchAdminMarketplace,
  fetchAdminNotificationFanoutHealth,
  fetchAdminOperationalHealth,
  fetchAdminReports,
  fetchAdminRecommendationAnalytics,
  fetchAdminRecommendationConfiguration,
  fetchAdminSupportRequests,
  fetchAdminTourQueue,
  fetchAdminTourReviewMetadata,
  fetchAdminUsers,
  insertAdminCategory,
  mutateAdminCategory,
  mutateAdminMarketplace,
  mutateAdminReport,
  mutateAdminSupportRequest,
  mutateAdminTour,
  mutateAdminUserRole,
  mutateAdminUserStatus,
  purgeAdminRecommendationCache,
} from '@/repositories/adminRepository';
import {
  normalizeAdminAuditRequest,
  normalizeAdminMarketplaceRequest,
  normalizeAdminHealthWindow,
  normalizeAdminReportsRequest,
  normalizeAdminSupportRequestsRequest,
  normalizeAdminTourDecision,
  normalizeAdminTourQueueRequest,
  normalizeAdminUsersRequest,
  normalizeCategoryCreate,
  normalizeCategoryUpdate,
  normalizeMarketplaceModeration,
  normalizeReportDecision,
  normalizeSupportResolution,
  normalizeUserRoleChange,
  normalizeUserStatusChange,
  normalizeAdminId,
} from '@/services/adminContracts';

function page(rows, limit, cursorFromRow) {
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > limit;
  const items = values.slice(0, limit);
  const last = hasMore ? items.at(-1) : null;
  return { items, nextCursor: last ? cursorFromRow(last) : null };
}

const chronologicalCursor = (row) => ({ at: row.created_at, id: row.item_id ?? row.user_id ?? row.report_id ?? row.request_id ?? row.audit_id });

export function getAdminDashboardStats() { return fetchAdminDashboardStats(); }

export async function getAdminMarketplace(request) {
  const normalized = normalizeAdminMarketplaceRequest(request);
  const result = page(await fetchAdminMarketplace(normalized), normalized.limit, chronologicalCursor);
  return { ...result, items: result.items.map((item) => ({ ...item, price: item.price == null ? null : Number(item.price), report_count: Number(item.report_count ?? 0) })) };
}

export function moderateAdminMarketplace(input) { return mutateAdminMarketplace(normalizeMarketplaceModeration(input)); }

export async function getAdminUsers(request) {
  const normalized = normalizeAdminUsersRequest(request);
  const result = page(await fetchAdminUsers(normalized), normalized.limit, chronologicalCursor);
  return { ...result, items: result.items.map((item) => ({ ...item, listing_count: Number(item.listing_count ?? 0), service_count: Number(item.service_count ?? 0) })) };
}

export function setAdminUserRole(input) { return mutateAdminUserRole(normalizeUserRoleChange(input)); }
export function setAdminUserStatus(input) { return mutateAdminUserStatus(normalizeUserStatusChange(input)); }

export async function getAdminReports(request) {
  const normalized = normalizeAdminReportsRequest(request);
  const result = page(await fetchAdminReports(normalized), normalized.limit, chronologicalCursor);
  return { ...result, items: result.items.map((item) => ({ ...item, reporter_tour_reports_24h: Number(item.reporter_tour_reports_24h ?? 0) })) };
}

export function reviewAdminReport(input) { return mutateAdminReport(normalizeReportDecision(input)); }

export async function getAdminSupportRequests(request) {
  const normalized = normalizeAdminSupportRequestsRequest(request);
  return page(await fetchAdminSupportRequests(normalized), normalized.limit, chronologicalCursor);
}

export function resolveAdminSupportRequest(input) { return mutateAdminSupportRequest(normalizeSupportResolution(input)); }

export async function getAdminTourQueue(request) {
  const normalized = normalizeAdminTourQueueRequest(request);
  const rows = await fetchAdminTourQueue(normalized);
  return page(rows, normalized.limit, (row) => ({
    reportedPriority: Number(row.reported_priority ?? 0),
    failedPriority: Number(row.failed_priority ?? 0),
    at: row.created_at,
    id: row.tour_id,
  }));
}

export function getAdminTourReviewMetadata(tourId) {
  return fetchAdminTourReviewMetadata(normalizeAdminId(tourId, 'Peek id'));
}

export function moderateAdminTour(input) { return mutateAdminTour(normalizeAdminTourDecision(input)); }

export async function getAdminAuditLog(request) {
  const normalized = normalizeAdminAuditRequest(request);
  return page(await fetchAdminAuditLog(normalized), normalized.limit, chronologicalCursor);
}

export async function getAdminCategories() {
  const rows = await fetchAdminCategories();
  return (rows ?? []).map((row) => ({ ...row, listing_count: Number(row.listing_count ?? 0) }));
}

export function addAdminCategory(input) { return insertAdminCategory(normalizeCategoryCreate(input)); }
export function updateAdminCategory(input) { return mutateAdminCategory(normalizeCategoryUpdate(input)); }

function numericRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, Number(item ?? 0)]));
}

export async function getAdminOperationalHealth(hours = 24) {
  const windowHours = normalizeAdminHealthWindow(hours);
  const [data, notificationFanout] = await Promise.all([fetchAdminOperationalHealth(windowHours), fetchAdminNotificationFanoutHealth()]);
  const metrics = data?.metrics && typeof data.metrics === 'object' ? data.metrics : {};
  return {
    windowHours: Number(data?.window_hours ?? windowHours),
    generatedAt: data?.generated_at ?? null,
    storageSnapshotAt: data?.storage_snapshot_at ?? null,
    queueSnapshotAt: data?.queue_snapshot_at ?? null,
    openAlerts: Array.isArray(data?.open_alerts) ? data.open_alerts.map((alert) => ({ ...alert, observed: Number(alert?.observed ?? 0), threshold: Number(alert?.threshold ?? 0) })) : [],
    metrics: Object.fromEntries(Object.entries(metrics).map(([name, metric]) => [name, { samples: Number(metric?.samples ?? 0), average: Number(metric?.average ?? 0), maximum: Number(metric?.maximum ?? 0) }])),
    queues: { ...numericRecord(data?.queues), notification_fanout_pending: Number(notificationFanout?.pending ?? 0), notification_fanout_claimed: Number(notificationFanout?.claimed ?? 0), notification_fanout_dead_lettered: Number(notificationFanout?.dead_lettered ?? 0), notification_fanout_oldest_pending_seconds: Number(notificationFanout?.oldest_pending_seconds ?? 0), notification_fanout_stale_claims: Number(notificationFanout?.stale_claims ?? 0) },
    notificationFanoutSnapshotAt: notificationFanout?.snapshot_at ?? null,
    storage: numericRecord(data?.storage),
  };
}

function normalizeAnalyticsMetric(value) {
  return { ...value, impressions: Number(value?.impressions ?? 0), clicks: Number(value?.clicks ?? 0), requests: Number(value?.requests ?? 0), clickThroughRate: Number(value?.clickThroughRate ?? 0) };
}

export async function getAdminRecommendationAnalytics(days = 30) {
  const boundedDays = Number.isInteger(days) ? Math.min(Math.max(days, 1), 90) : 30;
  const end = new Date();
  const start = new Date(end.getTime() - ((boundedDays - 1) * 86_400_000));
  const data = await fetchAdminRecommendationAnalytics(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  return { contractVersion: Number(data?.contractVersion ?? 1), startDate: data?.startDate ?? null, endDate: data?.endDate ?? null, generatedAt: data?.generatedAt ?? null, summary: normalizeAnalyticsMetric(data?.summary), services: Array.isArray(data?.services) ? data.services.map(normalizeAnalyticsMetric) : [], days: Array.isArray(data?.days) ? data.days.map(normalizeAnalyticsMetric) : [] };
}

export function getAdminRecommendationConfiguration() { return fetchAdminRecommendationConfiguration(); }
export function purgeAdminRecommendationServiceCache(serviceName, subjectListingId = null) { return purgeAdminRecommendationCache(serviceName, subjectListingId); }
