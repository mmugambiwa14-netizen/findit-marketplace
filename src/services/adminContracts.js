import {
  ADMIN_AUDIT_TARGET_TYPES,
  ADMIN_ASSIGNABLE_USER_ROLES,
  ADMIN_MARKETPLACE_MODERATION_ACTION_VALUES,
  ADMIN_MARKETPLACE_KINDS,
  ADMIN_MARKETPLACE_STATUSES,
  ADMIN_MUTABLE_USER_STATUSES,
  ADMIN_PEEK_QUEUE_STATUSES,
  ADMIN_PEEK_MODERATION_DECISIONS,
  ADMIN_REPORT_KIND_DATABASE_VALUES,
  ADMIN_REPORT_DECISION_STATUSES,
  ADMIN_REPORT_STATUSES,
  ADMIN_SUPPORT_CATEGORIES,
  ADMIN_SUPPORT_STATUSES,
  ADMIN_USER_ROLES,
  ADMIN_USER_STATUSES,
} from './adminConfig.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MARKETPLACE_KINDS = new Set(ADMIN_MARKETPLACE_KINDS);
const MARKETPLACE_ITEM_KINDS = new Set(ADMIN_MARKETPLACE_KINDS.filter((value) => value !== 'all'));
const MARKETPLACE_ACTIONS = new Set(ADMIN_MARKETPLACE_MODERATION_ACTION_VALUES);
const MARKETPLACE_STATUSES = new Set(ADMIN_MARKETPLACE_STATUSES);
const USER_ROLES = new Set(ADMIN_USER_ROLES);
const ASSIGNABLE_USER_ROLES = new Set(ADMIN_ASSIGNABLE_USER_ROLES);
const USER_STATUSES = new Set(ADMIN_USER_STATUSES);
const MUTABLE_USER_STATUSES = new Set(ADMIN_MUTABLE_USER_STATUSES);
const REPORT_STATUSES = new Set(ADMIN_REPORT_STATUSES);
const REPORT_KINDS = new Set(ADMIN_REPORT_KIND_DATABASE_VALUES);
const SUPPORT_STATUSES = new Set(ADMIN_SUPPORT_STATUSES);
const SUPPORT_CATEGORIES = new Set(ADMIN_SUPPORT_CATEGORIES);
const TOUR_STATUSES = new Set(ADMIN_PEEK_QUEUE_STATUSES);
const TOUR_DECISIONS = new Set(ADMIN_PEEK_MODERATION_DECISIONS);
const AUDIT_TARGET_TYPES = new Set(ADMIN_AUDIT_TARGET_TYPES);
const REPORT_DECISIONS = new Set(ADMIN_REPORT_DECISION_STATUSES);

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
    status: oneOf(input.status ?? 'all', MARKETPLACE_STATUSES, 'Status'),
    limit: boundedLimit(input.limit, 25),
    cursor: normalizeCursor(input.cursor, 'Marketplace cursor'),
  };
}

export function normalizeMarketplaceModeration(input) {
  const kind = oneOf(input?.kind, MARKETPLACE_ITEM_KINDS, 'Marketplace kind');
  const action = oneOf(input?.action, MARKETPLACE_ACTIONS, 'Moderation action');
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
    role: oneOf(input?.role, ASSIGNABLE_USER_ROLES, 'User role'),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeUserStatusChange(input) {
  const status = oneOf(input?.status, MUTABLE_USER_STATUSES, 'User status');
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
    status: oneOf(input?.status, REPORT_DECISIONS, 'Report decision'),
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
      reportedPriority: boundedInteger(input.cursor.reportedPriority, 'Reported priority', 0, 1, 0),
      failedPriority: boundedInteger(input.cursor.failedPriority, 'Failed priority', 0, 1, 0),
      ...normalizeCursor(input.cursor, 'Peek cursor'),
    },
  };
}

export function normalizeAdminTourDecision(input) {
  return {
    tourId: normalizeAdminId(input?.tourId, 'Peek id'),
    action: oneOf(input?.action, TOUR_DECISIONS, 'Peek decision'),
    reason: normalizeAdminReason(input?.reason),
  };
}

export function normalizeAdminAuditRequest(input = {}) {
  return {
    query: text(input.query, 'Search query', 100),
    targetType: oneOf(input.targetType ?? 'all', AUDIT_TARGET_TYPES, 'Target type'),
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
