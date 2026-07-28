import { normalizeKeysetCursor, normalizePageLimit } from './keysetPagination.js';

const SUPPORTED_KINDS = new Set(['property', 'car', 'machinery']);

function requiredIdentifier(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function boundedText(value, label, maximum, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new TypeError(`${label} is required`);
  if (normalized.length > maximum) throw new RangeError(`${label} is too long`);
  return normalized;
}

export function normalizeOwnerListingIdentity(ownerId, kind, listingId) {
  const normalizedKind = requiredIdentifier(kind, 'Listing kind');
  if (!SUPPORTED_KINDS.has(normalizedKind)) {
    throw new TypeError(`Unsupported listing kind: ${normalizedKind}`);
  }

  return {
    ownerId: requiredIdentifier(ownerId, 'Owner'),
    kind: normalizedKind,
    listingId: requiredIdentifier(listingId, 'Listing'),
  };
}

export function normalizeOwnerId(ownerId) {
  return requiredIdentifier(ownerId, 'Owner');
}

export function normalizeOwnerListingLimit(limit = 100) {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new RangeError('Owner listing limit must be between 1 and 200');
  }
  return parsed;
}


export function normalizeOwnerListingsPageRequest(ownerId, input = {}) {
  return {
    ownerId: normalizeOwnerId(ownerId),
    limit: normalizePageLimit(input.limit, { fallback: 30, maximum: 60 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}

export function normalizeOwnerListingUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Listing update is required');
  }

  const update = {};
  if (input.title !== undefined) {
    update.title = boundedText(input.title, 'Title', 160, { allowEmpty: false });
  }
  if (input.description !== undefined) {
    update.description = boundedText(input.description, 'Description', 5000);
  }
  if (input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0 || price > 999_999_999_999.99) {
      throw new RangeError('Price must be a valid non-negative amount');
    }
    update.price = price;
  }
  if (input.contact_phone !== undefined) {
    update.contact_phone = boundedText(input.contact_phone, 'Contact phone', 40) || null;
  }
  if (input.contact_whatsapp !== undefined) {
    update.contact_whatsapp = boundedText(input.contact_whatsapp, 'WhatsApp number', 40) || null;
  }
  if (input.contact_email !== undefined) {
    const email = boundedText(input.contact_email, 'Contact email', 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new TypeError('Contact email is invalid');
    }
    update.contact_email = email || null;
  }
  if (input.location_id !== undefined) {
    update.location_id = input.location_id === null || input.location_id === ''
      ? null
      : requiredIdentifier(input.location_id, 'Location');
  }
  if (Object.keys(update).length === 0) {
    throw new TypeError('No supported listing fields were provided');
  }
  return update;
}
