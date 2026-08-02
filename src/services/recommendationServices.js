import { supabase } from '@/lib/supabaseClient';

const DEFAULT_TIMEOUT_MS = 4500;
const MAX_PAGE_SIZE = 100;
const MAX_CURSOR_LENGTH = 1024;

// The services answer in a closed set of page sizes so the shared cache key space
// stays bounded. Requesting a bucket value directly keeps the page the caller asked
// for, the page the service returns, and the cursor that follows it all aligned; a
// request for an in-between size would otherwise leave the skipped items
// unreachable through the next cursor.
const LIMIT_BUCKETS = Object.freeze([6, 12, 24, 48, 100]);

function bucketedLimit(limit) {
  return LIMIT_BUCKETS.find((bucket) => limit <= bucket) ?? MAX_PAGE_SIZE;
}

const SERVICE_ENDPOINTS = Object.freeze({
  similar_listings_service: 'similar-listings',
  seller_recommendations_service: 'seller-recommendations',
  related_services_service: 'related-services',
  related_products_service: 'related-products',
  nearby_service: 'nearby-listings',
  recently_listed_service: 'recently-listed',
  personalized_recommendation_service: 'personalized-recommendations',
});

function emptyResult(service, reason = 'unavailable') {
  return {
    contractVersion: 1,
    service,
    requestId: null,
    items: [],
    nextCursor: null,
    degraded: true,
    reason,
  };
}

function validUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) return null;
  return resolved;
}

function normalizeCursor(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_CURSOR_LENGTH) return undefined;
  return value;
}

function normalizeItem(value, service) {
  if (!value || typeof value !== 'object') return null;
  if (service === 'related_services_service') {
    if (value.entityType !== 'service' || !validUuid(value.serviceId)) return null;
    return {
      entityType: 'service',
      serviceId: value.serviceId,
      providerId: validUuid(value.providerId) ? value.providerId : null,
      categoryKey: typeof value.categoryKey === 'string' ? value.categoryKey : null,
      subcategoryKey: typeof value.subcategoryKey === 'string' ? value.subcategoryKey : null,
      locationKey: validUuid(value.locationKey) ? value.locationKey : null,
      locationLabel: typeof value.locationLabel === 'string' ? value.locationLabel : null,
      priceAmount: typeof value.priceAmount === 'number' && Number.isFinite(value.priceAmount) ? value.priceAmount : null,
      currency: typeof value.currency === 'string' ? value.currency : null,
      publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : null,
      score: typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : 0,
      reasonCode: typeof value.reasonCode === 'string' ? value.reasonCode : 'unspecified',
    };
  }
  if (!validUuid(value.listingId)) return null;
  return {
    entityType: 'listing',
    listingId: value.listingId,
    sellerId: validUuid(value.sellerId) ? value.sellerId : null,
    categoryKey: typeof value.categoryKey === 'string' ? value.categoryKey : null,
    subcategoryKey: typeof value.subcategoryKey === 'string' ? value.subcategoryKey : null,
    countryCode: typeof value.countryCode === 'string' ? value.countryCode : null,
    locationKey: typeof value.locationKey === 'string' ? value.locationKey : null,
    priceAmount: typeof value.priceAmount === 'number' && Number.isFinite(value.priceAmount) ? value.priceAmount : null,
    currency: typeof value.currency === 'string' ? value.currency : null,
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : null,
    score: typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : 0,
    reasonCode: typeof value.reasonCode === 'string' ? value.reasonCode : 'unspecified',
  };
}

function normalizeResponse(service, value, limit) {
  if (!value || typeof value !== 'object' || value.service !== service || !Array.isArray(value.items)) {
    return emptyResult(service, 'invalid_response');
  }

  // Deduplicate by entity and never render more than the page size that was asked
  // for, so a repeated or over-long response cannot reach the surface.
  const seen = new Set();
  const items = [];
  for (const candidate of value.items) {
    const item = normalizeItem(candidate, service);
    const entityId = item?.entityType === 'service' ? item.serviceId : item?.listingId;
    if (!item || seen.has(entityId)) continue;
    seen.add(entityId);
    items.push(item);
    if (items.length === limit) break;
  }

  const nextCursor = value.nextCursor == null
    ? null
    : (typeof value.nextCursor === 'string' && value.nextCursor.length <= MAX_CURSOR_LENGTH ? value.nextCursor : null);

  return {
    contractVersion: Number.isInteger(value.contractVersion) ? value.contractVersion : 1,
    service,
    requestId: validUuid(value.requestId) ? value.requestId : null,
    items,
    nextCursor,
    degraded: value.degraded === true,
    reason: typeof value.reason === 'string' ? value.reason : null,
    stale: value.stale === true,
    cache: typeof value.cache === 'string' ? value.cache : null,
  };
}

async function invokeWithTimeout(endpoint, body, timeoutMs, signal) {
  // Abort the underlying request rather than only stopping waiting on it, so a slow
  // service is not still in flight after the viewer has navigated away.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ data: null, error: { code: 'client_timeout' } });
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      supabase.functions.invoke(endpoint, { body, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abort);
  }
}

/**
 * @param {keyof typeof SERVICE_ENDPOINTS} service
 * @param {{
 *   subjectListingId?: string,
 *   cursor?: string | null,
 *   limit?: number,
 *   maxDistanceMeters?: number,
 *   timeoutMs?: number,
 *   signal?: AbortSignal,
 * }} [options]
 */
async function fetchRecommendationService(service, {
  subjectListingId,
  cursor = null,
  limit = 12,
  maxDistanceMeters,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
} = {}) {
  const endpoint = SERVICE_ENDPOINTS[service];
  if (!endpoint) return emptyResult(service, 'unknown_service');

  const subjectRequired = !['recently_listed_service', 'personalized_recommendation_service'].includes(service);
  if (subjectRequired && !validUuid(subjectListingId)) return emptyResult(service, 'invalid_subject');

  const normalizedCursor = normalizeCursor(cursor);
  const requestedLimit = boundedInteger(limit, 12, 1, MAX_PAGE_SIZE);
  const normalizedTimeout = boundedInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 250, 5000);
  if (normalizedCursor === undefined || requestedLimit === null || normalizedTimeout === null) {
    return emptyResult(service, 'invalid_request');
  }
  const normalizedLimit = bucketedLimit(requestedLimit);

  /** @type {{
   *   subjectListingId?: string,
   *   cursor: string | null,
   *   limit: number,
   *   maxDistanceMeters?: number,
   * }} */
  const body = {
    ...(subjectRequired ? { subjectListingId } : {}),
    cursor: normalizedCursor,
    limit: normalizedLimit,
  };

  if (service === 'nearby_service') {
    const distance = boundedInteger(maxDistanceMeters, 50_000, 100, 500_000);
    if (distance === null) return emptyResult(service, 'invalid_distance');
    body.maxDistanceMeters = distance;
  }

  try {
    const { data, error } = await invokeWithTimeout(endpoint, body, normalizedTimeout, signal);
    if (error) return emptyResult(service, error.code === 'client_timeout' ? 'client_timeout' : 'service_unavailable');
    return normalizeResponse(service, data, normalizedLimit);
  } catch {
    return emptyResult(service, signal?.aborted ? 'cancelled' : 'service_unavailable');
  }
}

export const getSimilarListings = (options) => fetchRecommendationService('similar_listings_service', options);
export const getSellerRecommendations = (options) => fetchRecommendationService('seller_recommendations_service', options);
export const getRelatedServices = (options) => fetchRecommendationService('related_services_service', options);
export const getRelatedProducts = (options) => fetchRecommendationService('related_products_service', options);
export const getNearbyListings = (options) => fetchRecommendationService('nearby_service', options);
export const getRecentlyListed = (options) => fetchRecommendationService('recently_listed_service', options);
export const getPersonalizedRecommendations = (options) => fetchRecommendationService('personalized_recommendation_service', options);

export { fetchRecommendationService };
