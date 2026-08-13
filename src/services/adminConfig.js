/**
 * Canonical vocabulary and action transitions used by the founder console.
 *
 * Keep these values aligned with the server-side admin RPC contracts. Pages
 * should render these options instead of defining their own partial lists.
 */

function freezeOptions(options) {
  return Object.freeze(options.map((option) => Object.freeze(option)));
}

/** @typedef {'default'|'destructive'|'outline'|'secondary'|'ghost'|'link'} AdminButtonVariant */

/**
 * @param {string} value
 * @param {string} label
 * @param {AdminButtonVariant} variant
 * @param {{requiresMessage?: boolean, destructive?: boolean, confirmation?: string}} [extras]
 */
function adminAction(value, label, variant, extras = {}) {
  return { value, label, variant, ...extras };
}

export const ADMIN_MARKETPLACE_KIND_OPTIONS = freezeOptions([
  { value: 'all', label: 'All types' },
  { value: 'property', label: 'Property' },
  { value: 'car', label: 'Vehicles' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'service', label: 'Services' },
]);

export const ADMIN_MARKETPLACE_KINDS = Object.freeze(
  ADMIN_MARKETPLACE_KIND_OPTIONS.map(({ value }) => value),
);

export const ADMIN_MARKETPLACE_MODERATION_ACTIONS = Object.freeze({
  PUBLISH: 'publish',
  PAUSE: 'pause',
  REJECT: 'reject',
  REMOVE: 'remove',
});

export const ADMIN_MARKETPLACE_MODERATION_ACTION_VALUES = Object.freeze(
  Object.values(ADMIN_MARKETPLACE_MODERATION_ACTIONS),
);

export const ADMIN_MARKETPLACE_STATUS_OPTIONS = freezeOptions([
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft products' },
  { value: 'pending_review', label: 'Pending product review' },
  { value: 'available', label: 'Published products' },
  { value: 'under_offer', label: 'Under offer' },
  { value: 'rented', label: 'Rented' },
  { value: 'sold', label: 'Sold' },
  { value: 'paused', label: 'Paused adverts' },
  { value: 'unavailable', label: 'Unavailable adverts' },
  { value: 'rejected', label: 'Rejected products' },
  { value: 'expired', label: 'Expired products' },
  { value: 'active', label: 'Active services' },
]);

export const ADMIN_MARKETPLACE_STATUSES = Object.freeze(
  ADMIN_MARKETPLACE_STATUS_OPTIONS.map(({ value }) => value),
);

export const ADMIN_MARKETPLACE_LIVE_STATUSES = Object.freeze([
  'available',
  'under_offer',
  'rented',
  'active',
]);

/** @returns {Array<{value: string, label: string, variant: AdminButtonVariant, destructive?: boolean, confirmation?: string}>} */
export function marketplaceActions(item = {}) {
  const isProduct = item.item_kind !== 'service';
  const isLive = ADMIN_MARKETPLACE_LIVE_STATUSES.includes(item.status);
  const actions = [];
  if (isLive) actions.push(adminAction(ADMIN_MARKETPLACE_MODERATION_ACTIONS.PAUSE, 'Pause', 'outline'));
  if ((isProduct && item.status === 'pending_review') || (!isProduct && item.status === 'paused')) {
    actions.push(adminAction(ADMIN_MARKETPLACE_MODERATION_ACTIONS.PUBLISH, isProduct ? 'Approve' : 'Publish', 'outline'));
  }
  if (isProduct && item.status === 'pending_review') {
    actions.push(adminAction(ADMIN_MARKETPLACE_MODERATION_ACTIONS.REJECT, 'Reject', 'outline', { destructive: true, confirmation: 'REJECT' }));
  }
  actions.push(adminAction(ADMIN_MARKETPLACE_MODERATION_ACTIONS.REMOVE, 'Remove', 'destructive', { destructive: true, confirmation: 'REMOVE' }));
  return actions;
}

export const ADMIN_USER_ROLE_OPTIONS = freezeOptions([
  { value: 'all', label: 'All roles' },
  { value: 'user', label: 'Users' },
  { value: 'admin', label: 'Founder admin' },
]);

export const ADMIN_USER_ROLES = Object.freeze(ADMIN_USER_ROLE_OPTIONS.map(({ value }) => value));
export const ADMIN_ASSIGNABLE_USER_ROLES = Object.freeze(ADMIN_USER_ROLES.filter((value) => value !== 'all'));

export const ADMIN_USER_STATUS_OPTIONS = freezeOptions([
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
]);

export const ADMIN_USER_STATUSES = Object.freeze(ADMIN_USER_STATUS_OPTIONS.map(({ value }) => value));
export const ADMIN_MUTABLE_USER_STATUSES = Object.freeze(ADMIN_USER_STATUSES.filter((value) => value !== 'all'));

export const ADMIN_USER_ACTION_CONFIRMATIONS = Object.freeze({
  active: 'RESTORE',
  suspended: 'SUSPEND',
  banned: 'BAN',
});

export const ADMIN_BAN_DURATION_OPTIONS = freezeOptions([
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
]);

export const ADMIN_REPORT_STATUS_OPTIONS = freezeOptions([
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'actioned', label: 'Actioned' },
]);

export const ADMIN_REPORT_STATUSES = Object.freeze(ADMIN_REPORT_STATUS_OPTIONS.map(({ value }) => value));
export const ADMIN_REPORT_DECISION_STATUSES = Object.freeze(['reviewed', 'dismissed', 'actioned']);

export const ADMIN_REPORT_KIND_OPTIONS = freezeOptions([
  { value: 'all', label: 'All types' },
  { value: 'tour', label: 'Peeks' },
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'service', label: 'Services' },
  { value: 'message', label: 'Messages' },
]);

export const ADMIN_REPORT_KINDS = Object.freeze(ADMIN_REPORT_KIND_OPTIONS.map(({ value }) => value));

export const ADMIN_REPORT_REASON_LABELS = Object.freeze({
  fake: 'Fake / misleading',
  scam: 'Scam / fraud',
  duplicate: 'Duplicate',
  wrong_price: 'Wrong price',
  inappropriate: 'Inappropriate',
  spam: 'Spam',
  harassment: 'Harassment',
  unsafe: 'Unsafe behaviour',
  other: 'Other',
  unrelated_video: 'Unrelated Peek',
  misleading_representation: 'Misleading representation',
  stolen_content: 'Stolen content',
  unsafe_content: 'Unsafe content',
  inappropriate_content: 'Inappropriate content',
  prohibited_watermark: 'Prohibited watermark',
  suspected_fraud: 'Suspected fraud',
  duplicate_content: 'Duplicate content',
});

export const ADMIN_SEVERE_REPORT_REASONS = Object.freeze([
  'fake',
  'scam',
  'harassment',
  'unsafe',
  'unsafe_content',
  'inappropriate_content',
  'suspected_fraud',
  'stolen_content',
]);

export const ADMIN_SUPPORT_STATUS_OPTIONS = freezeOptions([
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All statuses' },
]);

export const ADMIN_SUPPORT_STATUSES = Object.freeze([
  'all',
  ...ADMIN_SUPPORT_STATUS_OPTIONS.filter(({ value }) => value !== 'all').map(({ value }) => value),
]);

export const ADMIN_SUPPORT_CATEGORY_OPTIONS = freezeOptions([
  { value: 'all', label: 'All categories' },
  { value: 'account', label: 'Account' },
  { value: 'listing', label: 'Listing' },
  { value: 'report', label: 'Report' },
  { value: 'safety', label: 'Safety' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
]);

export const ADMIN_SUPPORT_CATEGORIES = Object.freeze(
  ADMIN_SUPPORT_CATEGORY_OPTIONS.map(({ value }) => value),
);

// These are the target_record_type values emitted by current and legacy
// admin audit writers. Keeping both taxonomy and conversation-report entries
// visible prevents an operator from mistaking a missing filter for no event.
export const ADMIN_AUDIT_TARGET_OPTIONS = freezeOptions([
  { value: 'all', label: 'All targets' },
  { value: 'user', label: 'Users' },
  { value: 'property', label: 'Property' },
  { value: 'car', label: 'Vehicles' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'service', label: 'Services' },
  { value: 'report', label: 'Reports' },
  { value: 'conversation_report', label: 'Conversation reports' },
  { value: 'tour_report', label: 'Peek reports' },
  { value: 'listing_tour', label: 'Peeks' },
  { value: 'category', label: 'Legacy categories' },
  { value: 'taxonomy', label: 'Taxonomy' },
  { value: 'support_request', label: 'Support requests' },
  { value: 'business_application', label: 'Business applications' },
  { value: 'business_category', label: 'Business categories' },
  { value: 'managed_listing_request', label: 'Managed listing requests' },
]);

export const ADMIN_AUDIT_TARGET_TYPES = Object.freeze(
  ADMIN_AUDIT_TARGET_OPTIONS.map(({ value }) => value),
);

export const ADMIN_REPORT_KIND_DATABASE_VALUES = Object.freeze([
  'all',
  'property',
  'vehicle',
  'machinery',
  'service',
  'tour',
  'message',
]);

export const ADMIN_PEEK_QUEUE_STATUS_OPTIONS = freezeOptions([
  { value: 'pending', label: 'Pending review' },
  { value: 'reported', label: 'Reported' },
  { value: 'failed', label: 'Processing failures' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All Peeks' },
]);

export const ADMIN_PEEK_QUEUE_STATUSES = Object.freeze(
  ADMIN_PEEK_QUEUE_STATUS_OPTIONS.map(({ value }) => value),
);
export const ADMIN_PEEK_MODERATION_DECISIONS = Object.freeze(['approve', 'reject']);

export const ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS = freezeOptions([
  { value: '', label: 'All applications' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'needs_information', label: 'Needs information' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]);

export const ADMIN_BUSINESS_APPLICATION_STATUSES = Object.freeze(
  ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS.map(({ value }) => value),
);

export const ADMIN_BUSINESS_APPLICATION_ACTIONS = Object.freeze({
  START_REVIEW: 'start_review',
  REQUEST_INFORMATION: 'request_information',
  REJECT: 'reject',
});
export const ADMIN_BUSINESS_APPLICATION_ACTION_VALUES = Object.freeze(
  Object.values(ADMIN_BUSINESS_APPLICATION_ACTIONS),
);
export const ADMIN_BUSINESS_APPLICATION_MESSAGE_ACTIONS = Object.freeze([
  ADMIN_BUSINESS_APPLICATION_ACTIONS.REQUEST_INFORMATION,
  ADMIN_BUSINESS_APPLICATION_ACTIONS.REJECT,
]);

export const ADMIN_MANAGED_LISTING_STATUS_OPTIONS = freezeOptions([
  { value: '', label: 'All requests' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'needs_information', label: 'Needs information' },
  { value: 'declined', label: 'Declined' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
]);

export const ADMIN_MANAGED_LISTING_STATUSES = Object.freeze(
  ADMIN_MANAGED_LISTING_STATUS_OPTIONS.map(({ value }) => value),
);

export const ADMIN_MANAGED_LISTING_TRANSITIONS = Object.freeze({
  REVIEWING: 'reviewing',
  ACCEPTED: 'accepted',
  NEEDS_INFORMATION: 'needs_information',
  DECLINED: 'declined',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
});
export const ADMIN_MANAGED_LISTING_TRANSITION_VALUES = Object.freeze(
  Object.values(ADMIN_MANAGED_LISTING_TRANSITIONS),
);
export const ADMIN_MANAGED_LISTING_MESSAGE_TRANSITIONS = Object.freeze([
  ADMIN_MANAGED_LISTING_TRANSITIONS.NEEDS_INFORMATION,
  ADMIN_MANAGED_LISTING_TRANSITIONS.DECLINED,
  ADMIN_MANAGED_LISTING_TRANSITIONS.CANCELLED,
]);

export const ADMIN_BUSINESS_CATEGORY_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  SUSPEND: 'suspend',
});
export const ADMIN_BUSINESS_CATEGORY_ACTION_VALUES = Object.freeze(
  Object.values(ADMIN_BUSINESS_CATEGORY_ACTIONS),
);
export const ADMIN_BUSINESS_CATEGORY_MESSAGE_ACTIONS = Object.freeze([
  ADMIN_BUSINESS_CATEGORY_ACTIONS.REJECT,
  ADMIN_BUSINESS_CATEGORY_ACTIONS.SUSPEND,
]);

export const ADMIN_TAXONOMY_NODE_TYPE_OPTIONS = freezeOptions([
  { value: 'group', label: 'Group' },
  { value: 'category', label: 'Category' },
  { value: 'facet', label: 'Facet' },
]);

export function adminStatusLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

/** @returns {Array<{value: string, label: string, variant: AdminButtonVariant, requiresMessage?: boolean}>} */
export function businessApplicationActions(status) {
  if (status === 'submitted') {
    return [
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.START_REVIEW, 'Start review', 'outline'),
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.REQUEST_INFORMATION, 'Request information', 'outline', { requiresMessage: true }),
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.REJECT, 'Reject application', 'destructive', { requiresMessage: true }),
    ];
  }
  if (status === 'reviewing') {
    return [
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.REQUEST_INFORMATION, 'Request information', 'outline', { requiresMessage: true }),
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.REJECT, 'Reject application', 'destructive', { requiresMessage: true }),
    ];
  }
  if (status === 'needs_information') {
    return [
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.START_REVIEW, 'Resume review', 'outline'),
      adminAction(ADMIN_BUSINESS_APPLICATION_ACTIONS.REJECT, 'Reject application', 'destructive', { requiresMessage: true }),
    ];
  }
  return [];
}

/** @returns {Array<{value: string, label: string, variant: AdminButtonVariant, requiresMessage?: boolean}>} */
export function businessCategoryActions(status) {
  if (status === 'pending') {
    return [
      adminAction(ADMIN_BUSINESS_CATEGORY_ACTIONS.APPROVE, 'Approve', 'default'),
      adminAction(ADMIN_BUSINESS_CATEGORY_ACTIONS.REJECT, 'Reject', 'outline', { requiresMessage: true }),
    ];
  }
  if (status === 'approved') {
    return [adminAction(ADMIN_BUSINESS_CATEGORY_ACTIONS.SUSPEND, 'Suspend', 'destructive', { requiresMessage: true })];
  }
  if (status === 'suspended') {
    return [adminAction(ADMIN_BUSINESS_CATEGORY_ACTIONS.APPROVE, 'Reinstate', 'outline')];
  }
  if (status === 'rejected') {
    return [adminAction(ADMIN_BUSINESS_CATEGORY_ACTIONS.APPROVE, 'Approve after review', 'default')];
  }
  return [];
}

/** @returns {Array<{value: string, label: string, variant: AdminButtonVariant, requiresMessage?: boolean}>} */
export function managedListingActions(status) {
  const actions = {
    submitted: [
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.REVIEWING, 'Start review', 'outline'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.ACCEPTED, 'Accept', 'default'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.NEEDS_INFORMATION, 'Request information', 'outline', { requiresMessage: true }),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.DECLINED, 'Decline', 'destructive', { requiresMessage: true }),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.CANCELLED, 'Cancel', 'outline', { requiresMessage: true }),
    ],
    reviewing: [
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.ACCEPTED, 'Accept', 'default'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.NEEDS_INFORMATION, 'Request information', 'outline', { requiresMessage: true }),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.DECLINED, 'Decline', 'destructive', { requiresMessage: true }),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.CANCELLED, 'Cancel', 'outline', { requiresMessage: true }),
    ],
    needs_information: [
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.REVIEWING, 'Resume review', 'outline'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.ACCEPTED, 'Accept', 'default'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.DECLINED, 'Decline', 'destructive', { requiresMessage: true }),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.CANCELLED, 'Cancel', 'outline', { requiresMessage: true }),
    ],
    accepted: [
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.PUBLISHED, 'Mark published', 'default'),
      adminAction(ADMIN_MANAGED_LISTING_TRANSITIONS.CANCELLED, 'Cancel', 'outline', { requiresMessage: true }),
    ],
  };
  return actions[status] || [];
}
