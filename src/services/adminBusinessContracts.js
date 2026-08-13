import {
  ADMIN_BUSINESS_APPLICATION_ACTION_VALUES,
  ADMIN_BUSINESS_APPLICATION_MESSAGE_ACTIONS,
  ADMIN_BUSINESS_CATEGORY_ACTION_VALUES,
  ADMIN_BUSINESS_CATEGORY_MESSAGE_ACTIONS,
  ADMIN_BUSINESS_APPLICATION_STATUSES,
  ADMIN_MANAGED_LISTING_MESSAGE_TRANSITIONS,
  ADMIN_MANAGED_LISTING_STATUSES,
  ADMIN_MANAGED_LISTING_TRANSITION_VALUES,
  businessApplicationActions,
  businessCategoryActions,
  managedListingActions,
} from './adminConfig.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** @type {Set<string>} */
const BUSINESS_APPLICATION_ACTIONS = new Set(ADMIN_BUSINESS_APPLICATION_ACTION_VALUES);
/** @type {Set<string>} */
const BUSINESS_APPLICATION_MESSAGE_ACTIONS = new Set(ADMIN_BUSINESS_APPLICATION_MESSAGE_ACTIONS);
/** @type {Set<string>} */
const BUSINESS_CATEGORY_ACTIONS = new Set(ADMIN_BUSINESS_CATEGORY_ACTION_VALUES);
/** @type {Set<string>} */
const BUSINESS_CATEGORY_MESSAGE_ACTIONS = new Set(ADMIN_BUSINESS_CATEGORY_MESSAGE_ACTIONS);
/** @type {Set<string>} */
const MANAGED_LISTING_TRANSITIONS = new Set(ADMIN_MANAGED_LISTING_TRANSITION_VALUES);
/** @type {Set<string>} */
const MANAGED_LISTING_MESSAGE_TRANSITIONS = new Set(ADMIN_MANAGED_LISTING_MESSAGE_TRANSITIONS);

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) throw new TypeError(`${label} is invalid`);
  return value.trim().toLowerCase();
}

function boundedLimit(value, fallback = 50) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) throw new TypeError('Limit is invalid');
  return Math.min(Math.max(parsed, 1), 100);
}

function optionalTimestamp(value, label) {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) throw new TypeError(`${label} is invalid`);
  return parsed.toISOString();
}

function message(value, required) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > 1000) throw new TypeError('Reviewer message is too long');
  if (required && normalized.length < 3) throw new TypeError('A reviewer message is required');
  return normalized;
}

export function normalizeAdminBusinessApplicationsRequest({ status = null, limit = 50, before = null } = {}) {
  const normalizedStatus = status || null;
  if (normalizedStatus !== null && !ADMIN_BUSINESS_APPLICATION_STATUSES.includes(normalizedStatus)) {
    throw new TypeError('Business application status is invalid');
  }
  return { status: normalizedStatus, limit: boundedLimit(limit), before: optionalTimestamp(before, 'Application cursor') };
}

/** @param {{applicationId?: string, action?: string, reviewerMessage?: string}} input */
export function normalizeAdminBusinessApplicationReview({ applicationId, action, reviewerMessage = '' } = {}) {
  if (!BUSINESS_APPLICATION_ACTIONS.has(action)) throw new TypeError('Business application action is invalid');
  return {
    applicationId: uuid(applicationId, 'Business application id'),
    action,
    reviewerMessage: message(reviewerMessage, BUSINESS_APPLICATION_MESSAGE_ACTIONS.has(action)),
  };
}

/** @param {{categoryApprovalId?: string, action?: string, reviewerMessage?: string}} input */
export function normalizeAdminBusinessCategoryReview({ categoryApprovalId, action, reviewerMessage = '' } = {}) {
  if (!BUSINESS_CATEGORY_ACTIONS.has(action)) throw new TypeError('Business category action is invalid');
  return {
    categoryApprovalId: uuid(categoryApprovalId, 'Business category approval id'),
    action,
    reviewerMessage: message(reviewerMessage, BUSINESS_CATEGORY_MESSAGE_ACTIONS.has(action)),
  };
}

export function normalizeAdminManagedListingRequestsRequest({ status = null, limit = 50, before = null } = {}) {
  const normalizedStatus = status || null;
  if (normalizedStatus !== null && !ADMIN_MANAGED_LISTING_STATUSES.includes(normalizedStatus)) {
    throw new TypeError('Managed listing status is invalid');
  }
  return { status: normalizedStatus, limit: boundedLimit(limit), before: optionalTimestamp(before, 'Managed listing cursor') };
}

/** @param {{requestId?: string, status?: string, reviewerMessage?: string, assignedTo?: string|null}} input */
export function normalizeAdminManagedListingUpdate({ requestId, status, reviewerMessage = '', assignedTo = null } = {}) {
  if (!MANAGED_LISTING_TRANSITIONS.has(status)) throw new TypeError('Managed listing transition is invalid');
  return {
    requestId: uuid(requestId, 'Managed listing request id'),
    status,
    reviewerMessage: message(reviewerMessage, MANAGED_LISTING_MESSAGE_TRANSITIONS.has(status)),
    assignedTo: assignedTo == null || assignedTo === '' ? null : uuid(assignedTo, 'Assigned reviewer id'),
  };
}

export function canTransitionBusinessApplication(status, action) {
  return businessApplicationActions(status).some((entry) => entry.value === action);
}

export function canTransitionBusinessCategory(status, action) {
  return businessCategoryActions(status).some((entry) => entry.value === action);
}
