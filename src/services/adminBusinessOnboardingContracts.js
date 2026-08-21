// Pure request contracts for admin-initiated business onboarding and admin
// publication on behalf of a business. Kept free of the Supabase client so the
// rules can be exercised directly by tests rather than inferred from source
// text, and so the service layer stays a thin RPC boundary.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

export const PUBLISHING_CATEGORIES = Object.freeze(['property', 'car', 'machinery', 'service']);
export const INVENTORY_BANDS = Object.freeze(['1-10', '11-50', '51-200', '200+']);

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`${label} is invalid`);
  return value.toLowerCase();
}

function text(value, label, min, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) {
    throw new TypeError(`${label} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function optionalText(value, label, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized.length > max) throw new TypeError(`${label} is too long`);
  return normalized;
}

/**
 * The categories an admin may act on, deduplicated and ordered so the same
 * choice always produces the same request.
 */
export function normalizePublishingCategories(categories) {
  const requested = Array.isArray(categories) ? categories : [];
  return PUBLISHING_CATEGORIES.filter((category) => requested.includes(category));
}

export function normalizeBusinessAccountSearch(query, limit = 10) {
  const term = typeof query === 'string' ? query.trim() : '';
  if (term.length < 2) throw new TypeError('Search by at least two characters of an email address or name');
  if (term.length > 120) throw new TypeError('Search term is too long');
  const parsed = Number(limit ?? 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) throw new TypeError('Result limit is invalid');
  return { query: term, limit: parsed };
}

export function normalizeBusinessAccountRow(row) {
  return {
    userId: row?.user_id ?? null,
    email: row?.email || '',
    fullName: row?.full_name || '',
    phone: row?.phone || '',
    accountStatus: row?.account_status || 'active',
    applicationId: row?.application_id || null,
    applicationStatus: row?.application_status || 'not_started',
    approvedCategories: normalizePublishingCategories(row?.approved_categories),
    pendingCategories: normalizePublishingCategories(row?.pending_categories),
  };
}

/**
 * An onboarding request.
 *
 * When the account already has an application, the server keeps the details the
 * business submitted about itself and records only the publishing decision, so
 * the business fields are not required and are not sent.
 */
export function normalizeBusinessOnboarding(input) {
  const userId = uuid(input?.userId, 'Account');
  const categories = normalizePublishingCategories(input?.categories);
  if (categories.length === 0) throw new TypeError('Choose at least one publishing category');
  const note = optionalText(input?.note, 'Onboarding note', 1000);

  if (input?.hasExistingApplication) {
    return { userId, categories, note, businessDetails: null };
  }

  const expectedInventoryBand = String(input?.expectedInventoryBand ?? '');
  if (!INVENTORY_BANDS.includes(expectedInventoryBand)) {
    throw new TypeError('Choose a supported expected inventory band');
  }
  const businessEmail = String(input?.businessEmail ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(businessEmail) || businessEmail.length > 254) {
    throw new TypeError('Enter a valid business email address');
  }
  const countryCode = String(input?.countryCode ?? '').trim().toUpperCase();
  if (!COUNTRY_PATTERN.test(countryCode)) throw new TypeError('Enter a two-letter country code');

  return {
    userId,
    categories,
    note,
    businessDetails: {
      businessName: text(input?.businessName, 'Business name', 2, 160),
      contactName: text(input?.contactName, 'Contact name', 2, 120),
      businessEmail,
      businessPhone: text(input?.businessPhone, 'Business phone', 5, 40),
      countryCode,
      city: text(input?.city, 'City', 2, 120),
      description: text(input?.description, 'Business description', 20, 3000),
      websiteUrl: optionalText(input?.websiteUrl, 'Website', 300),
      socialUrl: optionalText(input?.socialUrl, 'Social profile', 300),
      expectedInventoryBand,
    },
  };
}

/**
 * The identity half of an admin publication.
 *
 * The uploader and the owner are deliberately separate and must not collapse
 * into one another: the images live under the uploading admin's storage prefix,
 * while the published listing belongs to the business.
 */
export function normalizeBusinessListingPublication(input) {
  const ownerUserId = uuid(input?.ownerUserId, 'Business account');
  const uploaderUserId = uuid(input?.uploaderUserId, 'Publishing admin');
  if (ownerUserId === uploaderUserId) {
    throw new TypeError('Publish your own listing through the normal listing flow');
  }
  const reason = text(input?.reason, 'Publication reason', 3, 1000);
  const managedRequestId = input?.managedRequestId
    ? uuid(input.managedRequestId, 'Managed listing request')
    : null;
  return { ownerUserId, uploaderUserId, reason, managedRequestId };
}
