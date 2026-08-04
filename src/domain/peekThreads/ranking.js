/**
 * Peek Thread ordering (Peek Threads phase 2).
 *
 * Two different orderings, for two different readers.
 *
 * Buyers browsing a listing want the threads worth reading: answered evidence
 * first, then what other buyers most want to see. Sellers working a queue want
 * the requests worth their next five minutes: most demand, oldest waiting.
 *
 * All of this sorts values the database already returns -- `supporter_count`
 * is the trigger-maintained counter from migration 0116, not something counted
 * on read.
 */

/** Thread filters offered on a listing page. */
export const THREAD_FILTERS = Object.freeze([
  { value: 'top', label: 'Top requests' },
  { value: 'answered', label: 'Answered' },
  { value: 'pending', label: 'Awaiting response' },
  { value: 'newest', label: 'Newest' },
]);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function ageInDays(value, now) {
  const created = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, (now - created) / MILLISECONDS_PER_DAY);
}

/**
 * Demand score for buyer-facing "Top requests".
 *
 * Supporters drive it, but with time decay, so a request from six months ago
 * with 30 supporters does not outrank a fresh one climbing fast. Answered
 * threads score below pending ones of equal demand: the point of the ordering
 * is to surface what still needs an answer.
 *
 * @param {{ supporter_count?: number, created_at?: string, status?: string }} request
 * @param {number} [now]
 */
export function demandScore(request, now = Date.now()) {
  const supporters = Number(request?.supporter_count) || 0;
  const age = ageInDays(request?.created_at, now);

  // Half-life of roughly two weeks. Long enough that a slow-burning request
  // survives, short enough that a stale one stops dominating.
  const freshness = 1 / (1 + age / 14);
  const base = (supporters + 1) * freshness;

  return request?.status === 'answered' ? base * 0.4 : base;
}

/**
 * Seller queue priority.
 *
 * The brief asks for interest count, age, listing priority and pending time.
 * Age and pending time are the same clock here -- a request has been pending
 * since it was created -- so waiting is counted once and weighted heavily:
 * a buyer who asked eight days ago and heard nothing is the seller's most
 * pressing debt, whatever the vote count.
 *
 * @param {{ supporter_count?: number, created_at?: string, listing_priority?: number }} request
 * @param {number} [now]
 */
export function sellerQueuePriority(request, now = Date.now()) {
  const supporters = Number(request?.supporter_count) || 0;
  const waitingDays = ageInDays(request?.created_at, now);
  const listingPriority = Number(request?.listing_priority) || 0;

  // Waiting grows without bound so an ignored request always eventually rises,
  // but sub-linearly so one ancient request does not bury a popular new one.
  return (supporters * 2) + Math.sqrt(waitingDays) * 3 + listingPriority;
}

/**
 * Orders threads for a listing page.
 *
 * Sorting is stable on id, so a request that ties with another does not swap
 * position between renders -- an unstable list under a "load more" button
 * duplicates or skips rows.
 *
 * @template {{ id: string, supporter_count?: number, created_at?: string, status?: string }} T
 * @param {ReadonlyArray<T>} requests
 * @param {'top'|'answered'|'pending'|'newest'} filter
 * @param {number} [now]
 * @returns {T[]}
 */
export function orderThreads(requests, filter = 'top', now = Date.now()) {
  const visible = (requests ?? []).filter((request) => {
    if (request?.status === 'removed' || request?.status === 'merged') return false;
    if (filter === 'answered') return request?.status === 'answered';
    if (filter === 'pending') return request?.status === 'pending';
    return true;
  });

  const byNewest = (left, right) => {
    const difference = new Date(right.created_at ?? 0) - new Date(left.created_at ?? 0);
    return difference !== 0 ? difference : String(right.id).localeCompare(String(left.id));
  };

  if (filter === 'newest') return [...visible].sort(byNewest);

  return [...visible].sort((left, right) => {
    const difference = demandScore(right, now) - demandScore(left, now);
    return difference !== 0 ? difference : byNewest(left, right);
  });
}

/**
 * Orders a seller's outstanding requests.
 *
 * @template {{ id: string, status?: string }} T
 * @param {ReadonlyArray<T>} requests
 * @param {number} [now]
 * @returns {T[]}
 */
export function orderSellerQueue(requests, now = Date.now()) {
  return (requests ?? [])
    .filter((request) => request?.status === 'pending')
    .slice()
    .sort((left, right) => {
      const difference = sellerQueuePriority(right, now) - sellerQueuePriority(left, now);
      return difference !== 0 ? difference : String(left.id).localeCompare(String(right.id));
    });
}

/**
 * Listing freshness summary (brief: "Latest Peek / Responds within / Answered %").
 *
 * Returns null rather than zeroes when a seller has no completed requests --
 * "answers 0% of requests" is a punishing thing to publish about someone who
 * has simply not been asked yet.
 *
 * @param {ReadonlyArray<{status?: string, created_at?: string, answered_at?: string}>} requests
 */
export function summariseResponsiveness(requests = []) {
  const settled = requests.filter(
    (request) => request?.status === 'answered' || request?.status === 'declined',
  );
  if (settled.length === 0) return null;

  const answered = settled.filter((request) => request.status === 'answered');

  const responseTimes = answered
    .map((request) => new Date(request.answered_at ?? 0) - new Date(request.created_at ?? 0))
    .filter((milliseconds) => Number.isFinite(milliseconds) && milliseconds > 0)
    .sort((left, right) => left - right);

  // Median, not mean: one seller who took three months to answer a single
  // request should not define how they are described.
  const median = responseTimes.length
    ? responseTimes[Math.floor(responseTimes.length / 2)]
    : null;

  return {
    answeredCount: answered.length,
    settledCount: settled.length,
    answeredRate: Math.round((answered.length / settled.length) * 100),
    medianResponseMs: median,
  };
}
