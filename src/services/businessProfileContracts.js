import { normalizeKeysetCursor, normalizePageLimit } from './keysetPagination.js';

const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const V1_BUSINESS_TYPES = Object.freeze([
  'real_estate_agency',
  'car_dealership',
  'heavy_machinery_dealer',
  'property_developer',
  'other',
]);

export const SOCIAL_LINK_KEYS = Object.freeze(['facebook', 'instagram', 'linkedin', 'x']);

function text(value, label, maximum, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  const normalized = value.trim();
  if (required && !normalized) throw new TypeError(`${label} is required`);
  if (normalized.length > maximum) throw new RangeError(`${label} is too long`);
  return normalized || null;
}

function httpUrl(value, label) {
  const normalized = text(value, label, 500);
  if (!normalized) return null;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError(`${label} must be a valid web address`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${label} must use http or https`);
  }
  return parsed.toString();
}

function email(value) {
  const normalized = text(value, 'Email', 254);
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new TypeError('Email is invalid');
  }
  return normalized?.toLowerCase() ?? null;
}

function socialLinks(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Social links must be an object');
  }
  const normalized = {};
  for (const key of Object.keys(value)) {
    if (!SOCIAL_LINK_KEYS.includes(key)) throw new TypeError(`Social link ${key} is not supported`);
    const url = httpUrl(value[key], `${key} link`);
    if (url) normalized[key] = url;
  }
  return normalized;
}

export function normalizeBusinessProfileId(value) {
  if (typeof value !== 'string' || !PROFILE_ID.test(value.trim())) {
    throw new TypeError('Business profile ID is invalid');
  }
  return value.trim().toLowerCase();
}

export function normalizeBusinessOwnerId(value) {
  if (typeof value !== 'string' || !PROFILE_ID.test(value.trim())) {
    throw new TypeError('Business owner ID is invalid');
  }
  return value.trim().toLowerCase();
}

export function normalizeBusinessProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Business profile details are required');
  }

  const companyName = text(input.company_name, 'Business name', 100, true);
  if (companyName.length < 2) throw new RangeError('Business name is too short');
  if (!V1_BUSINESS_TYPES.includes(input.business_type)) {
    throw new TypeError('Business type is invalid');
  }

  const phone = text(input.phone, 'Phone', 40);
  const normalizedEmail = email(input.email);
  if (!phone && !normalizedEmail) throw new TypeError('A phone number or email is required');

  return {
    company_name: companyName,
    business_type: input.business_type,
    phone,
    email: normalizedEmail,
    website: httpUrl(input.website, 'Website'),
    social_links: socialLinks(input.social_links),
    city: text(input.city, 'City', 120),
    address: text(input.address, 'Address', 300),
    description: text(input.description, 'Description', 1000),
  };
}

export function normalizeDealerInventoryQuery(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Inventory search must be text');
  return value.trim().replace(/\s+/g, ' ').slice(0, 100);
}


export function normalizeBusinessInventoryPageRequest(ownerId, input = {}) {
  return {
    ownerId: normalizeBusinessOwnerId(ownerId),
    dealerOnly: Boolean(input.dealerOnly),
    query: normalizeDealerInventoryQuery(input.query),
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}

export function normalizeBusinessServicesPageRequest(ownerId, input = {}) {
  return {
    ownerId: normalizeBusinessOwnerId(ownerId),
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}
