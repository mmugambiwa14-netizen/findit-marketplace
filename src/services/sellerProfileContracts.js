import { normalizeKeysetCursor, normalizePageLimit } from './keysetPagination.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSellerProfileEmail(value) {
  if (typeof value !== 'string') throw new TypeError('Seller email is required');
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('Seller email is invalid');
  }
  return email;
}


export function normalizeSellerListingsPageRequest(sellerId, input = {}) {
  const normalizedSellerId = typeof sellerId === 'string' ? sellerId.trim().toLowerCase() : '';
  if (!UUID_PATTERN.test(normalizedSellerId)) throw new TypeError('Seller ID is invalid');
  return {
    sellerId: normalizedSellerId,
    limit: normalizePageLimit(input.limit, { fallback: 24, maximum: 48 }),
    cursor: normalizeKeysetCursor(input.cursor),
  };
}
