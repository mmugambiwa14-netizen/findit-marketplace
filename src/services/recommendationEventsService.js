import { supabase } from '@/lib/supabaseClient';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';

const EVENT_TYPES = new Set([
  'view',
  'save',
  'tour_watch',
  'search',
  'chat_start',
  'seller_follow',
  'recommendation_impression',
  'recommendation_click',
]);

const CONTEXT_KEYS = new Set([
  'source',
  'surface',
  'position',
  'page_size',
  'result_count',
  'query_token_count',
  'watch_seconds',
  'category_key',
  'location_key',
  'is_repeat',
]);

const ANONYMOUS_SESSION_KEY = 'findit.recommendation-session.v1';
const REQUEST_TIMEOUT_MS = 1500;

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return null;
}

function getAnonymousSessionId() {
  const existing = readStoredString('session', ANONYMOUS_SESSION_KEY, null);
  if (existing) return existing;
  const generated = createSessionId();
  if (generated) writeStoredString('session', ANONYMOUS_SESSION_KEY, generated);
  return generated;
}

function sanitizeContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {};

  const safe = {};
  for (const [key, value] of Object.entries(context)) {
    if (!CONTEXT_KEYS.has(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 120);
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'boolean') safe[key] = value;
  }
  return safe;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function withTimeout(requestFactory) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ data: null, error: { code: 'client_timeout' } });
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([requestFactory(controller.signal), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @typedef {Object} RecommendationEventInput
 * @property {string} eventType
 * @property {string | null} [listingId]
 * @property {string | null} [serviceItemId]
 * @property {string | null} [sellerId]
 * @property {string | null} [recommendationRequestId]
 * @property {string | null} [recommendationService]
 * @property {string | null} [reasonCode]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @param {RecommendationEventInput} input
 */
export async function recordRecommendationEvent({
  eventType,
  listingId = null,
  serviceItemId = null,
  sellerId = null,
  recommendationRequestId = null,
  recommendationService = null,
  reasonCode = null,
  context = {},
}) {
  if (!EVENT_TYPES.has(eventType)) return { accepted: false, eventId: null };

  try {
    const normalizedServiceItemId = normalizeOptionalString(serviceItemId);
    const { data, error } = await withTimeout((signal) => {
      const request = normalizedServiceItemId
        ? supabase.rpc('record_recommended_service_event_v1', {
          p_event_type: eventType,
          p_service_id: normalizedServiceItemId,
          p_anonymous_session_id: getAnonymousSessionId(),
          p_recommendation_request_id: normalizeOptionalString(recommendationRequestId),
          p_recommendation_service: normalizeOptionalString(recommendationService),
          p_reason_code: normalizeOptionalString(reasonCode),
          p_context: sanitizeContext(context),
        })
        : supabase.rpc('record_recommendation_event', {
          p_event_type: eventType,
          p_listing_id: normalizeOptionalString(listingId),
          p_seller_id: normalizeOptionalString(sellerId),
          p_anonymous_session_id: getAnonymousSessionId(),
          p_recommendation_request_id: normalizeOptionalString(recommendationRequestId),
          p_recommendation_service: normalizeOptionalString(recommendationService),
          p_reason_code: normalizeOptionalString(reasonCode),
          p_context: sanitizeContext(context),
        });
      return request.abortSignal(signal);
    });

    if (error || typeof data !== 'string' || !data) {
      return { accepted: false, eventId: null };
    }

    return { accepted: true, eventId: data };
  } catch {
    return { accepted: false, eventId: null };
  }
}

/**
 * @param {RecommendationEventInput} event
 */
export function queueRecommendationEvent(event) {
  const enqueue = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback) => Promise.resolve().then(callback);

  enqueue(() => {
    void recordRecommendationEvent(event);
  });
}
