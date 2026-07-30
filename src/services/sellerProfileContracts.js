import { normalizeKeysetCursor, normalizePageLimit } from './keysetPagination.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSellerProfileId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function normalizeSellerProfileId(value) {
  if (!isSellerProfileId(value)) throw new TypeError('Seller ID is invalid');
  return value.trim().toLowerCase();
}

export function normalizeSellerListingsPageRequest(sellerId, input = {}) {
  return {
    sellerId: normalizeSellerProfileId(sellerId),
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}
