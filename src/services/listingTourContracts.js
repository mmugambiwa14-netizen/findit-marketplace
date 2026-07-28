const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TOUR_MAX_DURATION_SECONDS = 120;
export const TOUR_MAX_SOURCE_BYTES = 250 * 1024 * 1024;
export const TOUR_ALLOWED_MIME_TYPES = Object.freeze([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
export const TOUR_PARENT_TYPES = Object.freeze(['listing', 'service']);
export const TOUR_STATUSES = Object.freeze([
  'created',
  'upload_authorized',
  'uploaded',
  'processing',
  'ready',
  'failed',
  'superseded',
  'removed',
  'cleaned',
]);
export const TOUR_MODERATION_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'reported',
]);
export const TOUR_REPORT_REASONS = Object.freeze([
  'unrelated_video',
  'misleading_representation',
  'stolen_content',
  'unsafe_content',
  'inappropriate_content',
  'prohibited_watermark',
  'suspected_fraud',
  'duplicate_content',
]);

const MIME_TYPES = new Set(TOUR_ALLOWED_MIME_TYPES);
const PARENT_TYPES = new Set(TOUR_PARENT_TYPES);
const REPORT_REASONS = new Set(TOUR_REPORT_REASONS);

function uuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new TypeError(`${label} is invalid`);
  }
  return value.trim().toLowerCase();
}

export function normalizeTourParent(parentType, parentId) {
  if (!PARENT_TYPES.has(parentType)) throw new TypeError('Tour parent type is invalid');
  return { parentType, parentId: uuid(parentId, 'Tour parent') };
}

export function normalizeTourVideoFile(file, durationSeconds) {
  if (!(file instanceof File)) throw new TypeError('Choose a Tour video');
  if (!MIME_TYPES.has(file.type)) throw new TypeError('Use an MP4, MOV, or WebM video');
  if (file.size < 1 || file.size > TOUR_MAX_SOURCE_BYTES) {
    throw new RangeError('Tour videos must be 250 MB or smaller');
  }
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0 || duration > TOUR_MAX_DURATION_SECONDS) {
    throw new RangeError('Tour videos must be 2 minutes or shorter');
  }
  return { file, durationSeconds: duration };
}

export function normalizeTourUploadIntent(input) {
  const parent = normalizeTourParent(input?.parentType, input?.parentId);
  const { file, durationSeconds } = normalizeTourVideoFile(input?.file, input?.durationSeconds);
  const idempotencyKey = input?.idempotencyKey == null
    ? crypto.randomUUID()
    : uuid(input.idempotencyKey, 'Upload idempotency key');
  const sha256 = input?.sha256 == null || input.sha256 === ''
    ? null
    : String(input.sha256).trim().toLowerCase();
  if (sha256 && !/^[0-9a-f]{64}$/.test(sha256)) throw new TypeError('Video checksum is invalid');
  return {
    ...parent,
    file,
    durationSeconds,
    idempotencyKey,
    sha256,
    filename: file.name || 'tour-video',
    mimeType: file.type,
    byteSize: file.size,
  };
}

export function normalizeTourIntentId(value) {
  return uuid(value, 'Tour upload intent');
}

export function normalizeTourId(value) {
  return uuid(value, 'Tour');
}


export const TOUR_ADMIN_QUEUE_STATUSES = Object.freeze([
  'all',
  'pending',
  'approved',
  'rejected',
  'reported',
  'failed',
]);

const ADMIN_QUEUE_STATUSES = new Set(TOUR_ADMIN_QUEUE_STATUSES);

export function normalizeTourAdminQueueRequest(input = {}) {
  const query = typeof input.query === 'string' ? input.query.trim().slice(0, 100) : '';
  const status = typeof input.status === 'string' ? input.status : 'pending';
  if (!ADMIN_QUEUE_STATUSES.has(status)) throw new TypeError('Tour queue status is invalid');
  const limit = Number(input.limit ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Tour queue limit is invalid');

  let cursor = null;
  if (input.cursor != null) {
    const source = input.cursor;
    const reportedPriority = Number(source.reportedPriority);
    const failedPriority = Number(source.failedPriority);
    const at = new Date(source.at);
    if (![0, 1].includes(reportedPriority) || ![0, 1].includes(failedPriority)) {
      throw new TypeError('Tour queue cursor priority is invalid');
    }
    if (Number.isNaN(at.valueOf())) throw new TypeError('Tour queue cursor timestamp is invalid');
    cursor = {
      reportedPriority,
      failedPriority,
      at: at.toISOString(),
      id: normalizeTourId(source.id),
    };
  }
  return { query, status, limit, cursor };
}

export function normalizeTourAdminDecision(tourId, reason) {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  if (normalizedReason.length < 3 || normalizedReason.length > 1000) {
    throw new TypeError('An admin reason between 3 and 1000 characters is required');
  }
  return { tourId: normalizeTourId(tourId), reason: normalizedReason };
}

export function normalizeTourReport(input) {
  const tourId = normalizeTourId(input?.tourId);
  if (!REPORT_REASONS.has(input?.reason)) throw new TypeError('Tour report reason is invalid');
  const description = typeof input?.description === 'string'
    ? input.description.trim().slice(0, 2000)
    : '';
  return { tourId, reason: input.reason, description };
}

export function isTrustedTourSourcePath(value, ownerId, tourId) {
  if (typeof value !== 'string') return false;
  const owner = ownerId ? uuid(ownerId, 'Tour owner') : '[0-9a-f-]{36}';
  const tour = tourId ? uuid(tourId, 'Tour') : '[0-9a-f-]{36}';
  return new RegExp(`^${owner}/${tour}/source/[0-9a-f-]{36}\\.(?:mp4|mov|webm)$`, 'i').test(value);
}

export function normalizeTourPlaybackRequest(parentType, parentId) {
  return normalizeTourParent(parentType, parentId);
}


export const TOUR_FEED_CATEGORIES = Object.freeze([
  'all',
  'property',
  'car',
  'machinery',
  'service',
]);

const FEED_CATEGORIES = new Set(TOUR_FEED_CATEGORIES);

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function boundedHttpUrl(value) {
  const text = boundedText(value, 2048);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizedPrice(value) {
  if (value == null) return null;
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new TypeError('Tour feed price is invalid');
  return price;
}

export function normalizeTourFeedRequest(input = {}) {
  const category = boundedText(input.category, 24).toLowerCase() || 'all';
  if (!FEED_CATEGORIES.has(category)) throw new TypeError('Tour feed category is invalid');
  const query = boundedText(input.query, 100);
  const location = boundedText(input.location, 120);
  const limit = input.limit == null ? 8 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) {
    throw new RangeError('Tour feed limit must be between 1 and 24');
  }

  let cursor = null;
  if (input.cursor != null) {
    const id = uuid(input.cursor.id, 'Tour feed cursor');
    const publishedAt = new Date(String(input.cursor.publishedAt || ''));
    if (!Number.isFinite(publishedAt.getTime())) throw new TypeError('Tour feed cursor time is invalid');
    cursor = { id, publishedAt: publishedAt.toISOString() };
  }
  return { category, query, location, limit, cursor };
}

export function normalizeTourFeedResponse(value) {
  const items = Array.isArray(value?.items) ? value.items : [];
  const normalizedItems = items.map((item) => {
    const parent = normalizeTourParent(item?.parentType, item?.parentId);
    const tourId = normalizeTourId(item?.tourId);
    const listingType = boundedText(item?.listingType, 24).toLowerCase();
    if (!FEED_CATEGORIES.has(listingType) || listingType === 'all') {
      throw new TypeError('Tour feed listing type is invalid');
    }
    const publishedAt = new Date(String(item?.publishedAt || ''));
    if (!Number.isFinite(publishedAt.getTime())) throw new TypeError('Tour publication time is invalid');
    const durationSeconds = Number(item?.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > TOUR_MAX_DURATION_SECONDS) {
      throw new TypeError('Tour duration is invalid');
    }
    return {
      tourId,
      ...parent,
      listingType,
      title: boundedText(item?.title, 240) || 'Marketplace listing',
      price: normalizedPrice(item?.price),
      currency: boundedText(item?.currency, 12) || 'USD',
      pricingType: boundedText(item?.pricingType, 32) || null,
      publicLocation: boundedText(item?.publicLocation, 160),
      coverImageUrl: boundedHttpUrl(item?.coverImageUrl),
      thumbnailUrl: boundedHttpUrl(item?.thumbnailUrl),
      durationSeconds,
      availability: boundedText(item?.availability, 40),
      summaryAttributes: Array.isArray(item?.summaryAttributes)
        ? item.summaryAttributes.filter((attribute) => typeof attribute === 'string' && attribute.trim()).slice(0, 3)
        : [],
      sellerId: uuid(item?.sellerId, 'Tour seller'),
      sellerDisplayName: boundedText(item?.sellerDisplayName, 160) || 'FindIt seller',
      sellerType: boundedText(item?.sellerType, 40) || 'seller',
      publishedAt: publishedAt.toISOString(),
    };
  });

  const nextCursor = value?.nextCursor == null
    ? null
    : normalizeTourFeedRequest({ cursor: value.nextCursor }).cursor;
  const signedAssetLifetimeSeconds = Number(value?.signedAssetLifetimeSeconds);
  return {
    items: normalizedItems,
    nextCursor,
    signedAssetLifetimeSeconds: Number.isFinite(signedAssetLifetimeSeconds) && signedAssetLifetimeSeconds > 0
      ? signedAssetLifetimeSeconds
      : null,
  };
}
