import { normalizeKeysetCursor, normalizePageLimit } from './keysetPagination.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const V1_CATEGORIES = new Set(['property_developer', 'mechanic', 'equipment_services', 'construction', 'geological']);
const PRICING_TYPES = new Set(['fixed', 'starting_from', 'hourly', 'daily', 'quote', 'quote_required', 'contact_for_price']);
const SERVICE_STATUSES = new Set(['active', 'paused', 'unavailable']);
const SUPPORTED_CURRENCIES = new Set(['USD', 'ZWL', 'ZAR']);

function requireUuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function text(value, label, max, { required = false, min = 0 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && normalized.length < min) throw new TypeError(`${label} is required`);
  if (normalized.length > max) throw new TypeError(`${label} is too long`);
  return normalized;
}

function contactEmail(value) {
  const email = text(value, 'Contact email', 254).toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) throw new TypeError('Contact email is invalid');
  return email;
}

function price(value, pricingType) {
  if (['quote', 'quote_required', 'contact_for_price'].includes(pricingType)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000_000) {
    throw new TypeError('Price is invalid');
  }
  return parsed;
}

function currency(value) {
  const normalized = String(value || 'USD').toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(normalized)) throw new TypeError('Currency is invalid');
  return normalized;
}

function pricingType(value) {
  if (!PRICING_TYPES.has(value)) throw new TypeError('Pricing type is invalid');
  return value;
}

function contacts(input) {
  const phone = text(input.contact_phone, 'Phone', 40);
  const whatsapp = text(input.contact_whatsapp, 'WhatsApp', 40);
  const email = contactEmail(input.contact_email);
  if (!phone && !whatsapp) throw new TypeError('Phone or WhatsApp is required');
  return { contact_phone: phone || null, contact_whatsapp: whatsapp || null, contact_email: email || null };
}

function normalizeSubcategories(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new TypeError('At least one service type is required');
  }
  const normalized = [...new Set(value.map((item) => text(item, 'Service type', 80, { required: true, min: 1 })))];
  if (normalized.some((item) => !/^[a-z0-9_-]+$/.test(item))) {
    throw new TypeError('Service type is invalid');
  }
  return normalized;
}

export function normalizeServiceId(value) {
  return requireUuid(value, 'Service id');
}

export function normalizeProviderId(value) {
  return requireUuid(value, 'Provider id');
}

export function normalizePublicServiceRequest(input = {}) {
  const rawQuery = text(input.query, 'Search query', 80);
  const query = rawQuery
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s'&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const category = input.category ?? 'all';
  if (category !== 'all' && !V1_CATEGORIES.has(category)) throw new TypeError('Service category is invalid');
  return {
    category,
    query,
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}

export function normalizeOwnerServicePageRequest(providerId, input = {}) {
  return {
    providerId: normalizeProviderId(providerId),
    limit: normalizePageLimit(input.limit, { fallback: 30, maximum: 60 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}

export function normalizeServiceCreate(input, provider) {
  const category = input?.category;
  if (!V1_CATEGORIES.has(category)) throw new TypeError('Service category is invalid');
  const subcategories = normalizeSubcategories(input.subcategories);
  const selectedPricingType = pricingType(input.pricing_type ?? 'starting_from');
  return {
    provider_id: normalizeProviderId(provider.id),
    provider_name: text(provider.full_name, 'Provider name', 120) || null,
    ...contacts(input),
    title: text(input.title, 'Title', 120, { required: true, min: 3 }),
    description: text(input.description, 'Description', 5000) || null,
    category,
    subcategory: subcategories[0],
    subcategories,
    price: price(input.price, selectedPricingType),
    currency: currency(input.currency),
    pricing_type: selectedPricingType,
    photos: [],
    location_name: text(input.location_name, 'Location', 120) || null,
    can_travel: Boolean(input.can_travel),
    status: 'active',
  };
}

export function normalizeServiceEdit(input) {
  const allowed = new Set([
    'title', 'description', 'pricing_type', 'price', 'currency',
    'contact_phone', 'contact_whatsapp', 'contact_email',
  ]);
  for (const key of Object.keys(input ?? {})) {
    if (!allowed.has(key)) throw new TypeError(`Service field is not editable: ${key}`);
  }
  const selectedPricingType = pricingType(input.pricing_type ?? 'starting_from');
  return {
    ...contacts(input),
    title: text(input.title, 'Title', 120, { required: true, min: 3 }),
    description: text(input.description, 'Description', 5000) || null,
    pricing_type: selectedPricingType,
    price: price(input.price, selectedPricingType),
    currency: currency(input.currency),
  };
}

export function normalizeServiceStatus(value) {
  if (!SERVICE_STATUSES.has(value)) throw new TypeError('Service status is invalid');
  return value;
}
