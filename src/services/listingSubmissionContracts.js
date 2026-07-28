const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const KINDS = new Set(['property', 'car', 'machinery']);
const OFFER_TYPES = new Set(['sale', 'rent']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROPERTY_TYPES = new Set(['house', 'apartment', 'land', 'commercial', 'other']);
const FUEL_TYPES = new Set(['petrol', 'diesel', 'electric', 'hybrid']);
const TRANSMISSIONS = new Set(['manual', 'automatic']);
const MACHINERY_TYPES = new Set(['construction', 'agricultural', 'industrial', 'transport', 'other']);
const MACHINERY_CONDITIONS = new Set(['new', 'excellent', 'good', 'fair', 'needs_repair']);
const OWNER_ACTIONS = new Set(['submit', 'pause', 'resume', 'unavailable']);

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

function normalizeDetail(kind, input = {}) {
  const currentYear = new Date().getFullYear() + 1;
  if (kind === 'property') {
    return {
      propertyType: oneOf(input.propertyType, PROPERTY_TYPES, 'Property type'),
      bedrooms: optionalNumber(input.bedrooms, 'Bedrooms', 0, 100, { integer: true }),
      bathrooms: optionalNumber(input.bathrooms, 'Bathrooms', 0, 100, { integer: true }),
      sizeSqm: optionalNumber(input.sizeSqm, 'Property size', 0.01, 100_000_000),
    };
  }
  if (kind === 'car') {
    return {
      brand: text(input.brand, 'Vehicle make', 1, 80),
      model: text(input.model, 'Vehicle model', 1, 80),
      year: optionalNumber(input.year, 'Vehicle year', 1900, currentYear, { integer: true }),
      mileage: optionalNumber(input.mileage, 'Mileage', 0, 10_000_000, { integer: true }),
      fuelType: oneOf(input.fuelType, FUEL_TYPES, 'Fuel type'),
      transmission: oneOf(input.transmission, TRANSMISSIONS, 'Transmission'),
      condition: text(input.condition, 'Condition', 0, 40, { optional: true }).toLowerCase(),
    };
  }
  return {
    machineryType: oneOf(input.machineryType, MACHINERY_TYPES, 'Machinery type'),
    brand: text(input.brand, 'Machinery make', 1, 80),
    model: text(input.model, 'Machinery model', 1, 80),
    condition: oneOf(input.condition, MACHINERY_CONDITIONS, 'Machinery condition'),
    year: optionalNumber(input.year, 'Machinery year', 1900, currentYear, { integer: true }),
    usageHours: optionalNumber(input.usageHours, 'Usage hours', 0, 10_000_000, { integer: true }),
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
  const contactPhone = text(input?.contactPhone, 'Contact phone', 0, 40, { optional: true });
  const contactWhatsapp = text(input?.contactWhatsapp, 'WhatsApp number', 0, 40, { optional: true });
  const contactEmail = normalizeEmail(input?.contactEmail);
  if (!contactPhone && !contactWhatsapp && !contactEmail) throw new TypeError('Add at least one contact method');

  return {
    submissionKey: uuid(input?.submissionKey, 'Submission key'),
    listing: {
      kind,
      category,
      listingType: oneOf(input?.listingType, OFFER_TYPES, 'Offer type'),
      title: text(input?.title, 'Title', 10, 160),
      description: text(input?.description, 'Description', 50, 5000),
      price,
      currency: 'USD',
      negotiable: Boolean(input?.negotiable),
      locationId: uuid(input?.locationId, 'Location'),
      contactPhone,
      contactWhatsapp,
      contactEmail,
    },
    detail: normalizeDetail(kind, input?.detail),
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
