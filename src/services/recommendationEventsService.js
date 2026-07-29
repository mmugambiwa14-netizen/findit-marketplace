import { supabase } from '@/lib/supabaseClient';

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
  const generated = createSessionId();
  if (typeof window === 'undefined' || !window.sessionStorage) return generated;

  try {
    const existing = window.sessionStorage.getItem(ANONYMOUS_SESSION_KEY);
    if (existing) return existing;
    if (generated) window.sessionStorage.setItem(ANONYMOUS_SESSION_KEY, generated);
    return generated;
  } catch {
    return generated;
  }
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

async function withTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ data: null, error: { code: 'client_timeout' } }), REQUEST_TIMEOUT_MS);
  });

  const result = await Promise.race([promise, timeout]);
  clearTimeout(timeoutId);
  return result;
}

export async function recordRecommendationEvent({
  eventType,
  listingId = null,
  sellerId = null,
  recommendationRequestId = null,
  recommendationService = null,
  reasonCode = null,
  context = {},
} = {}) {
  if (!EVENT_TYPES.has(eventType)) return { accepted: false, eventId: null };

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('record_recommendation_event', {
        p_event_type: eventType,
        p_listing_id: normalizeOptionalString(listingId),
        p_seller_id: normalizeOptionalString(sellerId),
        p_anonymous_session_id: getAnonymousSessionId(),
        p_recommendation_request_id: normalizeOptionalString(recommendationRequestId),
        p_recommendation_service: normalizeOptionalString(recommendationService),
        p_reason_code: normalizeOptionalString(reasonCode),
        p_context: sanitizeContext(context),
      }),
    );

    if (error || typeof data !== 'string' || !data) {
      return { accepted: false, eventId: null };
    }

    return { accepted: true, eventId: data };
  } catch {
    return { accepted: false, eventId: null };
  }
}

export function queueRecommendationEvent(event) {
  const enqueue = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback) => Promise.resolve().then(callback);

  enqueue(() => {
    void recordRecommendationEvent(event);
  });
}
