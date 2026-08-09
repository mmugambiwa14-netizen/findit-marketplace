const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PURPOSES = new Set(['service_photo', 'business_logo', 'seller_logo']);
const TARGET_BY_PURPOSE = Object.freeze({
  service_photo: 'service',
  business_logo: 'business',
  seller_logo: 'seller',
});
const MAX_BYTES = 5 * 1024 * 1024;

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new TypeError(`${label} is invalid`);
  }
  return value.trim().toLowerCase();
}

export function normalizeMarketplaceImagePurpose(value) {
  if (!PURPOSES.has(value)) throw new TypeError('Image purpose is invalid');
  return value;
}

export function normalizeMarketplaceImageFile(file) {
  if (!(file instanceof File)) throw new TypeError('Choose an image to upload');
  if (!IMAGE_TYPES.has(file.type)) throw new TypeError('Use a JPG, PNG, or WebP image');
  if (file.size < 1 || file.size > MAX_BYTES) throw new RangeError('Each image must be 5 MB or smaller');
  return file;
}

export function isTrustedMarketplaceImagePath(value, purpose) {
  if (typeof value !== 'string') return false;
  const normalizedPurpose = purpose == null
    ? '(?:service_photo|business_logo|seller_logo)'
    : normalizeMarketplaceImagePurpose(purpose);
  return new RegExp(`^[0-9a-f-]{36}/${normalizedPurpose}/staging/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, 'i').test(value);
}

export function normalizeMarketplaceImageAttachment(input) {
  const purpose = normalizeMarketplaceImagePurpose(input?.purpose);
  const targetKind = TARGET_BY_PURPOSE[purpose];
  if (input?.targetKind !== targetKind) throw new TypeError('Image target does not match its purpose');
  if (!isTrustedMarketplaceImagePath(input?.path, purpose)) throw new TypeError('Image path is invalid');
  const displayOrder = Number(input?.displayOrder ?? 0);
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > (targetKind === 'service' ? 5 : 0)) {
    throw new RangeError('Image order is invalid');
  }
  return {
    intentId: uuid(input.intentId, 'Upload intent'),
    path: input.path,
    targetKind,
    targetId: uuid(input.targetId, 'Image target'),
    displayOrder,
  };
}

export function normalizeMarketplaceImageDetachment(targetKind, targetId, path) {
  const purpose = targetKind === 'service'
    ? 'service_photo'
    : targetKind === 'business'
      ? 'business_logo'
      : targetKind === 'seller'
        ? 'seller_logo'
        : null;
  if (!purpose) throw new TypeError('Image target is invalid');
  if (!isTrustedMarketplaceImagePath(path, purpose)) throw new TypeError('Image path is invalid');
  return { targetKind, targetId: uuid(targetId, 'Image target'), path };
}

export function normalizeServiceMediaReplacement(targetId, keepPaths, uploads) {
  const normalizedKeepPaths = Array.isArray(keepPaths) ? keepPaths : [];
  const normalizedUploads = Array.isArray(uploads) ? uploads : [];
  if (normalizedKeepPaths.length + normalizedUploads.length > 6) {
    throw new RangeError('A service can contain up to 6 images');
  }
  if (new Set(normalizedKeepPaths).size !== normalizedKeepPaths.length) {
    throw new TypeError('Existing service images must be unique');
  }
  normalizedKeepPaths.forEach((path) => {
    if (!isTrustedMarketplaceImagePath(path, 'service_photo')) {
      throw new TypeError('Existing service image path is invalid');
    }
  });
  const newMedia = normalizedUploads.map((upload) => {
    if (!isTrustedMarketplaceImagePath(upload?.path, 'service_photo')) {
      throw new TypeError('New service image path is invalid');
    }
    return {
      intentId: uuid(upload.intentId, 'Upload intent'),
      path: upload.path,
    };
  });
  const allPaths = [...normalizedKeepPaths, ...newMedia.map((item) => item.path)];
  if (new Set(allPaths).size !== allPaths.length) {
    throw new TypeError('Service images must be unique');
  }
  return {
    targetId: uuid(targetId, 'Image target'),
    keepPaths: normalizedKeepPaths,
    newMedia,
  };
}
