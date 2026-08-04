import { characterLength, sanitizeSingleLine } from '../../lib/sanitizeText.js';
import { isPeekRequestCategory } from './categories.js';

/**
 * Peek Request validation and lifecycle rules (Peek Threads phase 2).
 *
 * Bounds here mirror the CHECK constraints in migration 0116 exactly. If they
 * drift, the client accepts something Postgres then rejects with an opaque
 * 23514, which surfaces to a buyer as an unexplained failure. The alignment is
 * asserted in tests/peekThreadContracts.test.mjs.
 *
 * This runs in the browser and is therefore UX, not enforcement. The
 * server-side boundary is the CHECK constraints plus the RLS create policy,
 * which pins requester_id to auth.uid() and refuses any client-supplied
 * status, counter, moderation state or answering Peek.
 */

// Matches: char_length(btrim(body)) between 8 and 280
export const REQUEST_BODY_MIN = 8;
export const REQUEST_BODY_MAX = 280;
export const DECLINE_REASON_MAX = 280;

/**
 * Lifecycle, matching the `peek_request_status` enum.
 *
 * Transitions are explicit rather than "anything to anything" because the
 * states carry meaning a buyer sees: a request that goes from `answered` back
 * to `pending` would strip a Response Peek from a thread with no trace.
 */
export const REQUEST_STATUSES = Object.freeze([
  'pending', 'answered', 'declined', 'expired', 'merged', 'removed',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  // A pending request can be answered, refused, merged into a duplicate,
  // aged out, or removed by moderation.
  pending: Object.freeze(['answered', 'declined', 'merged', 'expired', 'removed']),
  // An answered request can be answered again with a better Peek -- the
  // response binding supersedes rather than replaces -- or removed.
  answered: Object.freeze(['answered', 'removed']),
  // A seller who declined can still change their mind and answer.
  declined: Object.freeze(['answered', 'removed']),
  // An expired request can be revived by a fresh answer.
  expired: Object.freeze(['answered', 'removed']),
  // Terminal. A merged request lives on only as a pointer to its target.
  merged: Object.freeze(['removed']),
  removed: Object.freeze([]),
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Validates a new Peek Request.
 *
 * @param {{ category?: unknown, body?: unknown, listingId?: unknown, serviceId?: unknown }} input
 * @returns {{ ok: true, value: { category: string, body: string, listing_id: string|null, service_id: string|null } }
 *          | { ok: false, errors: Array<{ field: string, message: string }> }}
 */
export function normalizePeekRequest(input = {}) {
  const errors = [];

  if (!isPeekRequestCategory(input.category)) {
    errors.push({ field: 'category', message: 'Choose what kind of Peek you want' });
  }

  // Single-line: a request is a question, and a newline in one is a display
  // spoofing vector on a thread card.
  const body = sanitizeSingleLine(input.body, REQUEST_BODY_MAX);
  const length = characterLength(body);

  if (length === 0) {
    errors.push({ field: 'body', message: 'Describe what you would like to see' });
  } else if (length < REQUEST_BODY_MIN) {
    errors.push({
      field: 'body',
      message: `Be a bit more specific -- at least ${REQUEST_BODY_MIN} characters`,
    });
  }

  const listingId = typeof input.listingId === 'string' && input.listingId ? input.listingId : null;
  const serviceId = typeof input.serviceId === 'string' && input.serviceId ? input.serviceId : null;

  // Mirrors peek_requests_single_parent.
  if ((listingId === null) === (serviceId === null)) {
    errors.push({ field: 'parent', message: 'A request must belong to one listing or one service' });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { category: String(input.category), body, listing_id: listingId, service_id: serviceId },
  };
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, errors: Array<{field: string, message: string}> }}
 */
export function normalizeDeclineReason(value) {
  const reason = sanitizeSingleLine(value, DECLINE_REASON_MAX);
  if (characterLength(reason) === 0) {
    return {
      ok: false,
      errors: [{ field: 'decline_reason', message: 'Tell the buyer why, briefly' }],
    };
  }
  return { ok: true, value: reason };
}

// --- Duplicate detection ---------------------------------------------------

// Words that carry no signal when comparing two requests. Without stripping
// these, "show me the engine" and "show me the roof" look 60% similar.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'can', 'could',
  'would', 'will', 'do', 'does', 'did', 'please', 'show', 'see', 'view', 'get',
  'me', 'us', 'i', 'we', 'you', 'your', 'my', 'of', 'in', 'on', 'at', 'to',
  'for', 'with', 'and', 'or', 'it', 'its', 'this', 'that', 'some', 'any',
  'more', 'also', 'want', 'like', 'need', 'possible', 'photo', 'photos',
  'video', 'peek', 'pic', 'pics', 'picture', 'pictures',
]);

/**
 * @param {string} value
 * @returns {Set<string>}
 */
function significantTokens(value) {
  return new Set(
    String(value ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

/**
 * Jaccard overlap of significant tokens, 0..1.
 *
 * Deliberately not fuzzy string distance: "show the front tyres" and "show the
 * rear tyres" are close by edit distance but are genuinely different requests,
 * and merging them would lose the one a buyer actually asked.
 *
 * @param {string} left
 * @param {string} right
 */
export function requestSimilarity(left, right) {
  const a = significantTokens(left);
  const b = significantTokens(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Above this, the composer offers "support it instead" rather than creating. */
export const DUPLICATE_THRESHOLD = 0.6;

/**
 * Finds an existing request the buyer should support instead of duplicating.
 *
 * Only pending and answered requests are candidates: a declined or removed
 * request is not something to redirect someone into.
 *
 * @param {string} body
 * @param {string} category
 * @param {ReadonlyArray<{id: string, body: string, category: string, status: string, supporter_count?: number}>} existing
 * @returns {{ id: string, body: string, similarity: number, supporterCount: number } | null}
 */
export function findDuplicateRequest(body, category, existing = []) {
  let best = null;

  for (const candidate of existing) {
    if (candidate.status !== 'pending' && candidate.status !== 'answered') continue;
    // Same wording in a different category is a different question -- "show
    // the tyres" under Condition asks about wear, under Measurements asks
    // about size.
    if (candidate.category !== category) continue;

    const similarity = requestSimilarity(body, candidate.body);
    if (similarity < DUPLICATE_THRESHOLD) continue;
    if (best && similarity <= best.similarity) continue;

    best = {
      id: candidate.id,
      body: candidate.body,
      similarity,
      supporterCount: candidate.supporter_count ?? 0,
    };
  }

  return best;
}
