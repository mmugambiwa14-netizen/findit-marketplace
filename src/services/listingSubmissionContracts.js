import { toStoragePayload } from './listingAttributes.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const KINDS = new Set(['property', 'car', 'machinery']);
const ASSET_OFFER_TYPES = new Set(['sale', 'rent']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Keep the browser contract aligned with the terminal states exposed by the
// owner UI and enforced by owner_transition_listing in the database.
const OWNER_ACTIONS = new Set(['submit', 'pause', 'resume', 'unavailable', 'sold', 'rented']);
const SUPPORTED_CURRENCIES = new Set(['USD', 'ZWL', 'ZAR']);

function text(value, label, min, max, { optional = false } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (optional && !normalized) return '';
  if (normalized.length < min) throw new TypeError(`${label} is too short`);
  if (normalized.length > max) throw new TypeError(`${label} is too long`);
  return normalized;
}

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function oneOf(value, allowed, label) {
  if (!allowed.has(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function optionalNumber(value, label, min, max, { integer = false } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new TypeError(`${label} is invalid`);
  }
  return parsed;
}

function normalizeEmail(value) {
  const email = text(value, 'Contact email', 0, 254, { optional: true }).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError('Contact email is invalid');
  return email;
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * The versioned listingSchema registry is the live classification contract.
 * It validates the answers, removes conditionally hidden values and produces
 * both the normalized detail columns and sparse versioned attributes document.
 */
function normalizeSchemaDetail(kind, listingType, input) {
  const rawDetail = objectValue(input);
  const schemaInput = kind === 'property'
    ? { ...rawDetail, listing_type: listingType }
    : rawDetail;
  const storage = toStoragePayload(kind, schemaInput);
  if (storage.ok === false) {
    throw new TypeError(storage.errors[0]?.message || 'Listing details are invalid');
  }

  const detail = { ...storage.columns };
  let normalizedListingType = listingType;
  if (kind === 'property') {
    // Property offer type is a registry field and therefore validated by the
    // same source of truth as every other property classification.
    normalizedListingType = detail.listing_type;
    delete detail.listing_type;
  } else {
    // Vehicles and machinery currently expose the shared marketplace sale/rent
    // transaction axis rather than a category-specific registry field.
    normalizedListingType = oneOf(listingType, ASSET_OFFER_TYPES, 'Offer type');
  }

  return {
    listingType: normalizedListingType,
    detail,
    attributes: storage.attributes,
  };
}

function normalizeMedia(ownerId, media) {
  if (!Array.isArray(media) || media.length < 1 || media.length > 20) {
    throw new TypeError('Add between 1 and 20 listing images');
  }
  const paths = new Set();
  return media.map((item) => {
    const intentId = uuid(item?.intentId, 'Image authorization');
    const path = text(item?.path, 'Image path', 1, 300);
    if (!path.startsWith(`${ownerId}/staging/`) || !/^[0-9a-f-]{36}\/staging\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)) {
      throw new TypeError('Image path is invalid');
    }
    if (paths.has(path)) throw new TypeError('Duplicate listing image');
    paths.add(path);
    return { intentId, path };
  });
}

export function normalizeListingSubmission(ownerId, input) {
  const normalizedOwnerId = uuid(ownerId, 'Owner');
  const kind = oneOf(input?.kind, KINDS, 'Listing kind');
  const category = text(input?.category, 'Category', 2, 80);
  if (!SLUG_PATTERN.test(category)) throw new TypeError('Category is invalid');
  const price = optionalNumber(input?.price, 'Price', 0.01, 999_999_999_999.99);
  const currency = oneOf(String(input?.currency || 'USD').toUpperCase(), SUPPORTED_CURRENCIES, 'Currency');
  const contactPhone = text(input?.contactPhone, 'Contact phone', 0, 40, { optional: true });
  const contactWhatsapp = text(input?.contactWhatsapp, 'WhatsApp number', 0, 40, { optional: true });
  const contactEmail = normalizeEmail(input?.contactEmail);
  if (!contactPhone && !contactWhatsapp && !contactEmail) throw new TypeError('Add at least one contact method');

  const schema = normalizeSchemaDetail(kind, input?.listingType, input?.detail);

  return {
    submissionKey: uuid(input?.submissionKey, 'Submission key'),
    listing: {
      kind,
      category,
      listingType: schema.listingType,
      title: text(input?.title, 'Title', 10, 160),
      description: text(input?.description, 'Description', 50, 5000),
      price,
      currency,
      negotiable: Boolean(input?.negotiable),
      locationId: uuid(input?.locationId, 'Location'),
      contactPhone,
      contactWhatsapp,
      contactEmail,
    },
    detail: schema.detail,
    attributes: schema.attributes,
    media: normalizeMedia(normalizedOwnerId, input?.media),
  };
}

export function normalizeListingImageFile(file) {
  if (!(file instanceof File)) throw new TypeError('Choose an image');
  if (!IMAGE_TYPES.has(file.type)) throw new TypeError('Use a JPG, PNG, or WebP image');
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new TypeError('Each image must be 5 MB or smaller');
  return file;
}

export function normalizeOwnerListingAction(listingId, action) {
  return {
    listingId: uuid(listingId, 'Listing'),
    action: oneOf(action, OWNER_ACTIONS, 'Listing action'),
  };
}

export function isTrustedListingImagePath(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}\/staging\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(value);
}

export function normalizeListingMediaReplacement(listingId, keepPaths, uploads) {
  const normalizedKeepPaths = Array.isArray(keepPaths) ? keepPaths : [];
  const normalizedUploads = Array.isArray(uploads) ? uploads : [];
  if (normalizedKeepPaths.length + normalizedUploads.length < 1
    || normalizedKeepPaths.length + normalizedUploads.length > 20) {
    throw new RangeError('A listing must contain between 1 and 20 images');
  }
  if (new Set(normalizedKeepPaths).size !== normalizedKeepPaths.length) {
    throw new TypeError('Existing listing images must be unique');
  }
  normalizedKeepPaths.forEach((path) => {
    if (!isTrustedListingImagePath(path)) throw new TypeError('Existing listing image path is invalid');
  });
  const newMedia = normalizedUploads.map((upload) => {
    if (!isTrustedListingImagePath(upload?.path)) throw new TypeError('New listing image path is invalid');
    return {
      intentId: uuid(upload.intentId, 'Image authorization'),
      path: upload.path,
    };
  });
  const allPaths = [...normalizedKeepPaths, ...newMedia.map((item) => item.path)];
  if (new Set(allPaths).size !== allPaths.length) throw new TypeError('Listing images must be unique');
  return {
    listingId: uuid(listingId, 'Listing'),
    keepPaths: normalizedKeepPaths,
    newMedia,
  };
}
