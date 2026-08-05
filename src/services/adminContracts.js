const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MARKETPLACE_KINDS = new Set(['all', 'property', 'car', 'machinery', 'service']);
const USER_ROLES = new Set(['all', 'user', 'admin']);
const USER_STATUSES = new Set(['all', 'active', 'suspended', 'banned']);
const REPORT_STATUSES = new Set(['all', 'pending', 'reviewed', 'dismissed', 'actioned']);
const REPORT_KINDS = new Set(['all', 'property', 'vehicle', 'machinery', 'service', 'tour', 'message']);
const SUPPORT_STATUSES = new Set(['all', 'open', 'resolved']);
const SUPPORT_CATEGORIES = new Set(['all', 'account', 'listing', 'report', 'safety', 'technical', 'other']);
const TOUR_STATUSES = new Set(['all', 'pending', 'processing', 'ready', 'failed', 'approved', 'rejected', 'published']);

function text(value, label, max, { required = false, min = 0 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && normalized.length < min) throw new TypeError(`${label} is required`);
  if (normalized.length > max) throw new TypeError(`${label} is too long`);
  return normalized;
}

function oneOf(value, allowed, label) {
  if (!allowed.has(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function boundedInteger(value, label, min, max, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return parsed;
}

function boundedLimit(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) throw new TypeError('Limit is invalid');
  return Math.min(Math.max(parsed, 1), 100);
}

function normalizeCursor(value, label = 'Cursor') {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  const at = new Date(value.at);
  if (Number.isNaN(at.valueOf())) throw new TypeError(`${label} timestamp is invalid`);
  const id = normalizeAdminId(value.id, `${label} id`);
  return { at: at.toISOString(), id };
}

export function normalizeAdminId(value, label = 'Record id') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

export function normalizeAdminReason(value) {
  return text(value, 'Admin reason', 1000, { required: true, min: 3 });
}

export function normalizeAdminMarketplaceRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    kind: oneOf(input.kind ?? 'all', MARKETPLACE_KINDS, 'Marketplace kind'),
    status: text(input.status ?? 'all', 'Status', 30, { required: true, min: 1 }),
    limit: boundedLimit(input.limit, 25),
    cursor: normalizeCursor(input.cursor, 'Marketplace cursor'),
  };
}

export function normalizeMarketplaceModeration(input) {
  const kind = oneOf(input?.kind, new Set(['property', 'car', 'machinery', 'service']), 'Marketplace kind');
  const action = oneOf(input?.action, new Set(['publish', 'pause', 'reject', 'remove']), 'Moderation action');
  return {
    itemId: normalizeAdminId(input?.itemId, 'Marketplace item id'),
    kind,
    action,
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeAdminUsersRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    role: oneOf(input.role ?? 'all', USER_ROLES, 'User role'),
    status: oneOf(input.status ?? 'all', USER_STATUSES, 'User status'),
    limit: boundedLimit(input.limit, 25),
    cursor: normalizeCursor(input.cursor, 'User cursor'),
  };
}

export function normalizeUserRoleChange(input) {
  return {
    userId: normalizeAdminId(input?.userId, 'User id'),
    role: oneOf(input?.role, new Set(['user', 'admin']), 'User role'),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeUserStatusChange(input) {
  const status = oneOf(input?.status, new Set(['active', 'suspended', 'banned']), 'User status');
  let banUntil = null;
  if (status === 'banned' && input?.banUntil) {
    const timestamp = new Date(input.banUntil);
    if (Number.isNaN(timestamp.valueOf())) throw new TypeError('Ban expiry is invalid');
    banUntil = timestamp.toISOString();
  }
  return {
    userId: normalizeAdminId(input?.userId, 'User id'),
    status,
    reason: normalizeAdminReason(input?.reason),
    banUntil,
  };
}

export function normalizeAdminReportsRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    status: oneOf(input.status ?? 'pending', REPORT_STATUSES, 'Report status'),
    kind: oneOf(input.kind ?? 'all', REPORT_KINDS, 'Report kind'),
    limit: boundedLimit(input.limit, 25),
    cursor: normalizeCursor(input.cursor, 'Report cursor'),
  };
}

export function normalizeReportDecision(input) {
  return {
    reportId: normalizeAdminId(input?.reportId, 'Report id'),
    status: oneOf(input?.status, new Set(['reviewed', 'dismissed', 'actioned']), 'Report decision'),
    notes: normalizeAdminReason(input?.notes),
  };
}

export function normalizeAdminSupportRequestsRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    status: oneOf(input.status ?? 'open', SUPPORT_STATUSES, 'Support status'),
    category: oneOf(input.category ?? 'all', SUPPORT_CATEGORIES, 'Support category'),
    limit: boundedLimit(input.limit, 25),
    cursor: normalizeCursor(input.cursor, 'Support cursor'),
  };
}

export function normalizeSupportResolution(input) {
  return {
    requestId: normalizeAdminId(input?.requestId, 'Support request id'),
    note: normalizeAdminReason(input?.note),
  };
}

export function normalizeAdminTourQueueRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    status: oneOf(input.status ?? 'pending', TOUR_STATUSES, 'Peek status'),
    limit: boundedLimit(input.limit, 25),
    cursor: input.cursor == null ? null : {
      reportedPriority: boundedInteger(input.cursor.reportedPriority, 'Reported priority', 0, 1_000_000, 0),
      failedPriority: boundedInteger(input.cursor.failedPriority, 'Failed priority', 0, 1_000_000, 0),
      ...normalizeCursor(input.cursor, 'Peek cursor'),
    },
  };
}

export function normalizeAdminTourDecision(input) {
  return {
    tourId: normalizeAdminId(input?.tourId, 'Peek id'),
    action: oneOf(input?.action, new Set(['approve', 'reject']), 'Peek decision'),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeAdminAuditRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    targetType: text(input.targetType ?? 'all', 'Target type', 40, { required: true, min: 1 }),
    limit: boundedLimit(input.limit, 50),
    cursor: normalizeCursor(input.cursor, 'Audit cursor'),
  };
}

export function normalizeCategoryCreate(input) {
  const slug = text(input?.slug, 'Category slug', 80, { required: true, min: 2 }).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new TypeError('Category slug is invalid');
  return {
    parentId: normalizeAdminId(input?.parentId, 'Parent category id'),
    slug,
    displayLabel: text(input?.displayLabel, 'Display label', 80, { required: true, min: 2 }),
    sortOrder: boundedInteger(input?.sortOrder, 'Sort order', 0, 10_000, 0),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeCategoryUpdate(input) {
  return {
    categoryId: normalizeAdminId(input?.categoryId, 'Category id'),
    displayLabel: text(input?.displayLabel, 'Display label', 80, { required: true, min: 2 }),
    sortOrder: boundedInteger(input?.sortOrder, 'Sort order', 0, 10_000, 0),
    isActive: Boolean(input?.isActive),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeAdminHealthWindow(value = 24) {
  return boundedInteger(value, 'Health window', 1, 168, 24);
}
