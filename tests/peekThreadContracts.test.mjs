import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PEEK_REQUEST_CATEGORIES,
  SUGGESTED_REQUESTS,
  isPeekRequestCategory,
  peekRequestCategory,
  peekRequestCategoryLabel,
  suggestedRequests,
} from '../src/domain/peekThreads/categories.js';
import {
  DECLINE_REASON_MAX,
  DUPLICATE_THRESHOLD,
  REQUEST_BODY_MAX,
  REQUEST_BODY_MIN,
  REQUEST_STATUSES,
  canTransition,
  findDuplicateRequest,
  normalizeDeclineReason,
  normalizePeekRequest,
  requestSimilarity,
} from '../src/domain/peekThreads/requestContracts.js';
import {
  THREAD_FILTERS,
  demandScore,
  orderSellerQueue,
  orderThreads,
  sellerQueuePriority,
  summariseResponsiveness,
} from '../src/domain/peekThreads/ranking.js';

const MIGRATION = 'supabase/migrations/0116_peek_threads_foundation.sql';

const migration = await readFile(MIGRATION, 'utf8');

/**
 * Pulls the literal values out of a `create type ... as enum (...)` block.
 * @param {string} name
 * @returns {string[]}
 */
function enumValues(name) {
  const block = migration.match(
    new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, 'i'),
  );
  assert.ok(block, `${MIGRATION} declares ${name}`);
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

// --- The contract that matters most: client vocabulary equals DB vocabulary --
//
// A category or status that exists in JavaScript but not in the enum is
// rejected by Postgres as 22P02 with no field attribution, which reaches a
// buyer as an unexplained failure after they have typed their request.

test('request categories match the peek_request_category enum exactly', () => {
  const database = enumValues('peek_request_category');
  const client = PEEK_REQUEST_CATEGORIES.map((entry) => entry.value);

  assert.deepEqual([...client].sort(), [...database].sort());
  assert.equal(client.length, 9, 'the brief specifies nine request categories');
});

test('request statuses match the peek_request_status enum exactly', () => {
  const database = enumValues('peek_request_status');
  assert.deepEqual([...REQUEST_STATUSES].sort(), [...database].sort());
});

test('body bounds match the peek_requests_body_length CHECK', () => {
  const check = migration.match(
    /peek_requests_body_length check \(\s*char_length\(btrim\(body\)\) between (\d+) and (\d+)/i,
  );
  assert.ok(check, `${MIGRATION} bounds the request body`);
  assert.equal(REQUEST_BODY_MIN, Number(check[1]));
  assert.equal(REQUEST_BODY_MAX, Number(check[2]));
});

test('decline reason bound matches the peek_requests_decline_reason_length CHECK', () => {
  const check = migration.match(
    /peek_requests_decline_reason_length check \(.*?char_length\(decline_reason\) <= (\d+)/is,
  );
  assert.ok(check, `${MIGRATION} bounds the decline reason`);
  assert.equal(DECLINE_REASON_MAX, Number(check[1]));
});

test('every category carries a label and a hint, and lookups are total', () => {
  for (const entry of PEEK_REQUEST_CATEGORIES) {
    assert.ok(entry.label.length > 0, `${entry.value} has a label`);
    assert.ok(entry.hint.length > 0, `${entry.value} has a hint`);
    assert.equal(peekRequestCategory(entry.value)?.value, entry.value);
    assert.equal(peekRequestCategoryLabel(entry.value), entry.label);
    assert.equal(isPeekRequestCategory(entry.value), true);
  }

  assert.equal(isPeekRequestCategory('upvote'), false);
  assert.equal(isPeekRequestCategory(null), false);
  assert.equal(peekRequestCategory('nope'), null);
  // Falls back rather than rendering "undefined" on a thread card built from a
  // row written by a newer client than the one reading it.
  assert.equal(peekRequestCategoryLabel('nope'), 'Request');
});

test('every suggested request names a real category and passes its own validator', () => {
  for (const [kind, suggestions] of Object.entries(SUGGESTED_REQUESTS)) {
    assert.ok(suggestions.length > 0, `${kind} has suggestions`);
    for (const suggestion of suggestions) {
      assert.equal(
        isPeekRequestCategory(suggestion.category),
        true,
        `${kind}: "${suggestion.body}" uses a real category`,
      );
      const result = normalizePeekRequest({
        category: suggestion.category,
        body: suggestion.body,
        listingId: 'listing-1',
      });
      assert.equal(result.ok, true, `${kind}: "${suggestion.body}" is itself submittable`);
    }
  }

  assert.equal(suggestedRequests('property'), SUGGESTED_REQUESTS.property);
  // Unknown kinds must still offer something; an empty composer is how
  // "show more pics" requests happen.
  assert.ok(suggestedRequests('unknown-kind').length > 0);
});

// --- Lifecycle -------------------------------------------------------------

test('lifecycle transitions are explicit, not anything-to-anything', () => {
  assert.equal(canTransition('pending', 'answered'), true);
  assert.equal(canTransition('pending', 'declined'), true);
  assert.equal(canTransition('pending', 'merged'), true);
  assert.equal(canTransition('pending', 'expired'), true);

  // A seller may replace a Response Peek with a better one.
  assert.equal(canTransition('answered', 'answered'), true);
  // ...but a thread never loses its answer by reverting to pending.
  assert.equal(canTransition('answered', 'pending'), false);
  assert.equal(canTransition('answered', 'declined'), false);

  // A change of heart is allowed in the direction that helps the buyer.
  assert.equal(canTransition('declined', 'answered'), true);
  assert.equal(canTransition('expired', 'answered'), true);

  // Merged is a pointer, not a state to climb back out of.
  assert.equal(canTransition('merged', 'answered'), false);
  assert.equal(canTransition('merged', 'pending'), false);

  assert.deepEqual(REQUEST_STATUSES.filter((to) => canTransition('removed', to)), []);
  assert.equal(canTransition('not-a-status', 'answered'), false);
});

test('every status reachable by a transition is a real status', () => {
  for (const from of REQUEST_STATUSES) {
    for (const to of REQUEST_STATUSES) {
      if (!canTransition(from, to)) continue;
      assert.ok(REQUEST_STATUSES.includes(to), `${from} -> ${to} names a real status`);
    }
  }
});

// --- Request validation ----------------------------------------------------

test('a well-formed request normalizes to the row the database expects', () => {
  const result = normalizePeekRequest({
    category: 'operation',
    body: '  Show a cold   engine start  ',
    listingId: 'listing-1',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    category: 'operation',
    body: 'Show a cold engine start',
    listing_id: 'listing-1',
    service_id: null,
  });
});

test('a request must belong to exactly one parent, mirroring peek_requests_single_parent', () => {
  const neither = normalizePeekRequest({ category: 'condition', body: 'Show the roof and gutters' });
  assert.equal(neither.ok, false);
  assert.ok(neither.errors.some((error) => error.field === 'parent'));

  const both = normalizePeekRequest({
    category: 'condition',
    body: 'Show the roof and gutters',
    listingId: 'listing-1',
    serviceId: 'service-1',
  });
  assert.equal(both.ok, false);
  assert.ok(both.errors.some((error) => error.field === 'parent'));

  const service = normalizePeekRequest({
    category: 'condition',
    body: 'Show the roof and gutters',
    serviceId: 'service-1',
  });
  assert.equal(service.ok, true);
  assert.equal(service.value.listing_id, null);
  assert.equal(service.value.service_id, 'service-1');
});

test('bodies too short to be actionable are refused before the database sees them', () => {
  const empty = normalizePeekRequest({ category: 'custom', body: '   ', listingId: 'l' });
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((error) => error.field === 'body'));

  const terse = normalizePeekRequest({ category: 'custom', body: 'more', listingId: 'l' });
  assert.equal(terse.ok, false);
  assert.ok(terse.errors.some((error) => error.field === 'body'));

  const exact = normalizePeekRequest({
    category: 'custom',
    body: 'a'.repeat(REQUEST_BODY_MIN),
    listingId: 'l',
  });
  assert.equal(exact.ok, true, 'the minimum length itself is accepted');
});

test('an over-long body is truncated to the CHECK bound rather than rejected', () => {
  const result = normalizePeekRequest({
    category: 'custom',
    body: 'x'.repeat(REQUEST_BODY_MAX + 200),
    listingId: 'l',
  });

  assert.equal(result.ok, true);
  assert.equal(Array.from(result.value.body).length, REQUEST_BODY_MAX);
});

test('a newline in a request body cannot spoof a thread card', () => {
  const result = normalizePeekRequest({
    category: 'condition',
    body: 'Show the roof\nAnswered by the seller',
    listingId: 'l',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.body.includes('\n'), false);
});

test('invisible characters are stripped from a request body', () => {
  // Zero-width space between two words, plus a right-to-left override.
  const zeroWidth = '​';
  const bidiOverride = '‮';

  const result = normalizePeekRequest({
    category: 'condition',
    body: `Show the${zeroWidth} roof and ${bidiOverride}gutters`,
    listingId: 'l',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.body.includes(zeroWidth), false);
  assert.equal(result.value.body.includes(bidiOverride), false);
});

test('a missing or invented category is refused', () => {
  const invented = normalizePeekRequest({
    category: 'engine_noise',
    body: 'Show the engine running',
    listingId: 'l',
  });
  assert.equal(invented.ok, false);
  assert.ok(invented.errors.some((error) => error.field === 'category'));

  assert.equal(normalizePeekRequest().ok, false, 'no argument is a validation failure, not a throw');
});

test('a decline needs a reason the buyer can read', () => {
  assert.equal(normalizeDeclineReason('   ').ok, false);
  assert.equal(normalizeDeclineReason(null).ok, false);

  const given = normalizeDeclineReason('  The vehicle is no longer on site  ');
  assert.equal(given.ok, true);
  assert.equal(given.value, 'The vehicle is no longer on site');

  const long = normalizeDeclineReason('y'.repeat(DECLINE_REASON_MAX + 50));
  assert.equal(long.ok, true);
  assert.equal(Array.from(long.value).length, DECLINE_REASON_MAX);
});

// --- Duplicate detection ---------------------------------------------------

test('near-identical requests are recognised as the same question', () => {
  assert.ok(
    requestSimilarity('Show the roof and gutters', 'Please show the roof and gutters')
      >= DUPLICATE_THRESHOLD,
  );
  assert.ok(
    requestSimilarity('Show the underside of the vehicle', 'Can we see the vehicle underside')
      >= DUPLICATE_THRESHOLD,
  );
});

test('similar wording about different parts stays a different request', () => {
  // The case that rules out fuzzy string distance: one character apart in
  // meaning, and merging them loses the question a buyer actually asked.
  const similarity = requestSimilarity(
    'Show the front tyres and tread',
    'Show the rear tyres and tread',
  );
  assert.ok(
    similarity < DUPLICATE_THRESHOLD,
    `front and rear tyres must stay distinct, got ${similarity}`,
  );

  assert.ok(requestSimilarity('Show the kitchen cupboards inside', 'Show the kitchen')
    < DUPLICATE_THRESHOLD);
  assert.equal(requestSimilarity('', 'Show the roof'), 0);
  assert.equal(requestSimilarity('show me the', 'please see it'), 0, 'stopwords alone carry no signal');
});

test('the composer redirects a duplicate to the request already gathering support', () => {
  const existing = [
    {
      id: 'req-1',
      body: 'Show the roof and gutters',
      category: 'condition',
      status: 'pending',
      supporter_count: 7,
    },
    {
      id: 'req-2',
      body: 'Show the front tyres and tread',
      category: 'condition',
      status: 'pending',
      supporter_count: 2,
    },
  ];

  const duplicate = findDuplicateRequest('Please show the roof and gutters', 'condition', existing);
  assert.equal(duplicate?.id, 'req-1');
  assert.equal(duplicate?.supporterCount, 7);
  assert.ok(duplicate.similarity >= DUPLICATE_THRESHOLD);

  assert.equal(
    findDuplicateRequest('Show the engine bay wiring', 'condition', existing),
    null,
    'an unrelated request is not merged into an existing one',
  );
});

test('the same wording under a different category is a different question', () => {
  const existing = [{
    id: 'req-1',
    body: 'Show the tyres',
    category: 'condition',
    status: 'pending',
    supporter_count: 3,
  }];

  assert.equal(findDuplicateRequest('Show the tyres', 'measurements', existing), null);
  assert.equal(findDuplicateRequest('Show the tyres', 'condition', existing)?.id, 'req-1');
});

test('declined and removed requests are never offered as somewhere to redirect support', () => {
  const body = 'Show the roof and gutters';
  for (const status of ['declined', 'removed', 'merged', 'expired']) {
    const existing = [{ id: 'req-1', body, category: 'condition', status, supporter_count: 4 }];
    assert.equal(
      findDuplicateRequest(body, 'condition', existing),
      null,
      `a ${status} request is not a redirect target`,
    );
  }

  const answered = [{
    id: 'req-1',
    body,
    category: 'condition',
    status: 'answered',
    supporter_count: 4,
  }];
  assert.equal(
    findDuplicateRequest(body, 'condition', answered)?.id,
    'req-1',
    'an answered request is worth pointing at -- the evidence already exists',
  );
});

test('duplicate detection returns the strongest match, not the first', () => {
  const existing = [
    {
      id: 'weak',
      body: 'Show the roof gutters and downpipes and the fascia boards',
      category: 'condition',
      status: 'pending',
      supporter_count: 1,
    },
    {
      id: 'strong',
      body: 'Show the roof and gutters',
      category: 'condition',
      status: 'pending',
      supporter_count: 1,
    },
  ];

  assert.equal(findDuplicateRequest('Show the roof and gutters', 'condition', existing)?.id, 'strong');
});

test('duplicate detection tolerates an empty candidate list', () => {
  assert.equal(findDuplicateRequest('Show the roof and gutters', 'condition'), null);
  assert.equal(findDuplicateRequest('Show the roof and gutters', 'condition', []), null);
});

// --- Ranking ---------------------------------------------------------------

const NOW = Date.parse('2026-08-04T00:00:00Z');
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

test('the filters the brief specifies are the filters offered', () => {
  assert.deepEqual(
    THREAD_FILTERS.map((filter) => filter.value),
    ['top', 'answered', 'pending', 'newest'],
  );
  for (const filter of THREAD_FILTERS) assert.ok(filter.label.length > 0);
});

test('demand decays, so a stale request does not hold the top slot forever', () => {
  const fresh = { supporter_count: 3, created_at: daysAgo(1), status: 'pending' };
  const stale = { supporter_count: 12, created_at: daysAgo(180), status: 'pending' };

  assert.ok(
    demandScore(fresh, NOW) > demandScore(stale, NOW),
    'four times the supporters, six months old, still ranks below a fresh climber',
  );
});

test('an answered thread ranks below a pending one of equal demand', () => {
  const shape = { supporter_count: 5, created_at: daysAgo(3) };
  assert.ok(
    demandScore({ ...shape, status: 'pending' }, NOW)
      > demandScore({ ...shape, status: 'answered' }, NOW),
  );
});

test('demand scoring survives missing and malformed fields', () => {
  assert.equal(Number.isFinite(demandScore({}, NOW)), true);
  assert.equal(Number.isFinite(demandScore({ created_at: 'not-a-date' }, NOW)), true);
  assert.equal(Number.isFinite(demandScore(null, NOW)), true);
  // A request dated in the future must not score as infinitely fresh.
  const future = demandScore({ supporter_count: 1, created_at: daysAgo(-30) }, NOW);
  assert.equal(future, demandScore({ supporter_count: 1, created_at: daysAgo(0) }, NOW));
});

test('removed and merged threads never appear on a listing page', () => {
  const requests = [
    { id: 'a', status: 'pending', supporter_count: 1, created_at: daysAgo(1) },
    { id: 'b', status: 'removed', supporter_count: 90, created_at: daysAgo(1) },
    { id: 'c', status: 'merged', supporter_count: 90, created_at: daysAgo(1) },
  ];

  for (const filter of THREAD_FILTERS.map((entry) => entry.value)) {
    const ids = orderThreads(requests, filter, NOW).map((request) => request.id);
    assert.equal(ids.includes('b'), false, `${filter} hides removed`);
    assert.equal(ids.includes('c'), false, `${filter} hides merged`);
  }
});

test('the answered and pending filters show only their own status', () => {
  const requests = [
    { id: 'a', status: 'pending', supporter_count: 1, created_at: daysAgo(1) },
    { id: 'b', status: 'answered', supporter_count: 1, created_at: daysAgo(2) },
    { id: 'c', status: 'declined', supporter_count: 1, created_at: daysAgo(3) },
  ];

  assert.deepEqual(orderThreads(requests, 'answered', NOW).map((r) => r.id), ['b']);
  assert.deepEqual(orderThreads(requests, 'pending', NOW).map((r) => r.id), ['a']);
  // "Top" is everything still visible, ranked -- including declined, which a
  // buyer is entitled to see was asked and refused.
  assert.deepEqual(orderThreads(requests, 'top', NOW).map((r) => r.id).sort(), ['a', 'b', 'c']);
});

test('newest orders by creation date, not demand', () => {
  const requests = [
    { id: 'old-popular', status: 'pending', supporter_count: 50, created_at: daysAgo(30) },
    { id: 'new-quiet', status: 'pending', supporter_count: 0, created_at: daysAgo(1) },
  ];

  assert.deepEqual(
    orderThreads(requests, 'newest', NOW).map((request) => request.id),
    ['new-quiet', 'old-popular'],
  );
});

test('ordering is deterministic on ties, so "load more" cannot duplicate or skip a row', () => {
  const requests = [
    { id: 'a', status: 'pending', supporter_count: 4, created_at: daysAgo(2) },
    { id: 'b', status: 'pending', supporter_count: 4, created_at: daysAgo(2) },
    { id: 'c', status: 'pending', supporter_count: 4, created_at: daysAgo(2) },
  ];

  const forward = orderThreads(requests, 'top', NOW).map((request) => request.id);
  const reversed = orderThreads([...requests].reverse(), 'top', NOW).map((request) => request.id);

  assert.deepEqual(forward, reversed, 'input order does not change output order');
  assert.deepEqual([...forward].sort(), ['a', 'b', 'c'], 'no row is lost or repeated');
});

test('ordering does not mutate the array it was given', () => {
  const requests = Object.freeze([
    { id: 'a', status: 'pending', supporter_count: 1, created_at: daysAgo(5) },
    { id: 'b', status: 'pending', supporter_count: 9, created_at: daysAgo(5) },
  ]);

  const ordered = orderThreads(requests, 'top', NOW);
  assert.deepEqual(requests.map((request) => request.id), ['a', 'b']);
  assert.deepEqual(ordered.map((request) => request.id), ['b', 'a']);
  assert.deepEqual(orderThreads(undefined, 'top', NOW), []);
  assert.deepEqual(orderSellerQueue(undefined, NOW), []);
});

test('the seller queue holds only what is still owed an answer', () => {
  const requests = [
    { id: 'pending', status: 'pending', supporter_count: 1, created_at: daysAgo(1) },
    { id: 'answered', status: 'answered', supporter_count: 40, created_at: daysAgo(1) },
    { id: 'declined', status: 'declined', supporter_count: 40, created_at: daysAgo(1) },
    { id: 'expired', status: 'expired', supporter_count: 40, created_at: daysAgo(1) },
  ];

  assert.deepEqual(orderSellerQueue(requests, NOW).map((request) => request.id), ['pending']);
});

test('an ignored request rises up the seller queue as it waits', () => {
  const ignored = { id: 'ignored', status: 'pending', supporter_count: 1, created_at: daysAgo(1) };
  const later = { ...ignored, created_at: daysAgo(40) };

  assert.ok(sellerQueuePriority(later, NOW) > sellerQueuePriority(ignored, NOW));
});

test('listing priority breaks a tie between equally demanded requests', () => {
  const base = { id: 'x', supporter_count: 3, created_at: daysAgo(2) };
  assert.ok(
    sellerQueuePriority({ ...base, listing_priority: 5 }, NOW)
      > sellerQueuePriority({ ...base, listing_priority: 0 }, NOW),
  );
});

test('demand still outweighs a single day of waiting', () => {
  const wanted = { id: 'a', supporter_count: 12, created_at: daysAgo(1) };
  const lonely = { id: 'b', supporter_count: 0, created_at: daysAgo(3) };

  assert.ok(sellerQueuePriority(wanted, NOW) > sellerQueuePriority(lonely, NOW));
});

test('the seller queue is deterministic on ties', () => {
  const requests = [
    { id: 'b', status: 'pending', supporter_count: 2, created_at: daysAgo(4) },
    { id: 'a', status: 'pending', supporter_count: 2, created_at: daysAgo(4) },
  ];

  assert.deepEqual(
    orderSellerQueue(requests, NOW).map((request) => request.id),
    orderSellerQueue([...requests].reverse(), NOW).map((request) => request.id),
  );
});

// --- Responsiveness --------------------------------------------------------

test('a seller nobody has asked yet is not described as answering nothing', () => {
  assert.equal(summariseResponsiveness([]), null);
  assert.equal(summariseResponsiveness(), null);
  assert.equal(
    summariseResponsiveness([{ status: 'pending', created_at: daysAgo(2) }]),
    null,
    'pending requests are not evidence of unresponsiveness yet',
  );
});

test('response time is reported as a median, so one outlier does not define a seller', () => {
  const hours = (n) => n * 60 * 60 * 1000;
  // Built explicitly rather than derived, so the intended gaps are readable:
  // one hour, two hours, ninety days.
  const settled = [
    {
      status: 'answered',
      created_at: new Date(NOW - hours(100)).toISOString(),
      answered_at: new Date(NOW - hours(99)).toISOString(),
    },
    {
      status: 'answered',
      created_at: new Date(NOW - hours(100)).toISOString(),
      answered_at: new Date(NOW - hours(98)).toISOString(),
    },
    {
      status: 'answered',
      created_at: new Date(NOW - hours(24 * 90)).toISOString(),
      answered_at: new Date(NOW).toISOString(),
    },
    { status: 'declined', created_at: new Date(NOW - hours(50)).toISOString() },
  ];

  const summary = summariseResponsiveness(settled);
  assert.equal(summary.answeredCount, 3);
  assert.equal(summary.settledCount, 4);
  assert.equal(summary.answeredRate, 75);
  assert.equal(summary.medianResponseMs, hours(2), 'the ninety-day outlier does not move the median');
});

test('a settled history with no measurable response time reports null rather than zero', () => {
  const summary = summariseResponsiveness([
    { status: 'declined', created_at: new Date(NOW - 1000).toISOString() },
  ]);

  assert.equal(summary.answeredCount, 0);
  assert.equal(summary.settledCount, 1);
  assert.equal(summary.answeredRate, 0);
  assert.equal(summary.medianResponseMs, null);
});

// --- Terminology -----------------------------------------------------------
//
// The brief is explicit: "Never use the word Upvote". Guarding it here means a
// future phase cannot reintroduce it through the domain layer, which is where
// the UI will take its labels from.

test('the Peek Threads domain never says upvote', async () => {
  const modules = ['categories.js', 'requestContracts.js', 'ranking.js'];
  for (const name of modules) {
    const source = await readFile(`src/domain/peekThreads/${name}`, 'utf8');
    assert.equal(
      /upvote/i.test(source),
      false,
      `src/domain/peekThreads/${name} must call it support, not upvote`,
    );
  }
});
