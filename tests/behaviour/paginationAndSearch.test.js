import { describe, expect, test } from 'vitest';
import {
  applyDescendingCreatedAtCursor,
  createKeysetPage,
  normalizeKeysetCursor,
  normalizePageLimit,
} from '@/services/keysetPagination';
import {
  normalizePublicSearchCursor,
  normalizePublicSearchPageRequest,
} from '@/services/searchContracts';

// Keyset pagination is what stops a public listing endpoint from being walked
// as a bulk export, and what keeps deep pages cheap. These exercise the real
// cursor arithmetic rather than asserting the source contains a regex.

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const NEXT_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('keyset cursor normalisation', () => {
  test('normalises a valid cursor and lowercases the id', () => {
    expect(normalizeKeysetCursor({ createdAt: '2026-01-01T00:00:00Z', id: ID.toUpperCase() }))
      .toEqual({ createdAt: '2026-01-01T00:00:00.000Z', id: ID });
  });

  test('treats null as "first page" rather than an error', () => {
    expect(normalizeKeysetCursor(null)).toBeNull();
    expect(normalizeKeysetCursor(undefined)).toBeNull();
  });

  test.each([
    ['an array', []],
    ['a string', 'cursor'],
    ['a number', 7],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeKeysetCursor(value)).toThrow(/Pagination cursor is invalid/);
  });

  test('rejects a non-uuid id so the cursor cannot smuggle a predicate', () => {
    expect(() => normalizeKeysetCursor({ createdAt: '2026-01-01T00:00:00Z', id: "' OR 1=1--" }))
      .toThrow(/Pagination cursor ID is invalid/);
  });

  test('rejects an unparseable timestamp', () => {
    expect(() => normalizeKeysetCursor({ createdAt: 'yesterday', id: ID }))
      .toThrow(/timestamp is invalid/);
  });
});

describe('page limit clamping', () => {
  test('applies the default when nothing is supplied', () => {
    expect(normalizePageLimit(undefined)).toBe(24);
  });

  test('clamps above the maximum', () => {
    expect(normalizePageLimit(1000)).toBe(60);
  });

  test('clamps below one', () => {
    expect(normalizePageLimit(0)).toBe(1);
    expect(normalizePageLimit(-10)).toBe(1);
  });

  test('falls back for a non-integer rather than truncating', () => {
    expect(normalizePageLimit(12.5)).toBe(24);
  });

  test('honours a caller-supplied maximum', () => {
    expect(normalizePageLimit(500, { maximum: 100 })).toBe(100);
  });
});

describe('keyset page construction', () => {
  const rows = (count) => Array.from({ length: count }, (_, index) => ({
    id: index === count - 1 ? NEXT_ID : ID,
    created_at: `2026-01-0${(index % 9) + 1}T00:00:00.000Z`,
  }));

  test('returns exactly the requested number of items when more exist', () => {
    const page = createKeysetPage(rows(5), 4);
    expect(page.items).toHaveLength(4);
  });

  test('emits a next cursor only when an extra row proves there is more', () => {
    expect(createKeysetPage(rows(5), 4).nextCursor).not.toBeNull();
    expect(createKeysetPage(rows(4), 4).nextCursor).toBeNull();
  });

  test('the next cursor points at the last returned item, not the lookahead row', () => {
    const source = rows(5);
    const page = createKeysetPage(source, 4);
    expect(page.nextCursor).toEqual({
      createdAt: source[3].created_at,
      id: source[3].id,
    });
  });

  test('handles a non-array defensively rather than throwing', () => {
    expect(createKeysetPage(null, 10)).toEqual({ items: [], nextCursor: null });
  });

  test('an empty result set terminates pagination', () => {
    expect(createKeysetPage([], 10)).toEqual({ items: [], nextCursor: null });
  });
});

describe('descending cursor predicate', () => {
  test('returns the query untouched for the first page', () => {
    const query = { or: () => 'called' };
    expect(applyDescendingCreatedAtCursor(query, null)).toBe(query);
  });

  test('builds a strict tiebreaker so no row is skipped or repeated', () => {
    let received = '';
    const query = { or: (expression) => { received = expression; return 'filtered'; } };

    applyDescendingCreatedAtCursor(query, { createdAt: '2026-01-01T00:00:00.000Z', id: ID });

    expect(received).toBe(
      `created_at.lt.2026-01-01T00:00:00.000Z,and(created_at.eq.2026-01-01T00:00:00.000Z,id.lt.${ID})`,
    );
  });
});

describe('public search request normalisation', () => {
  test('falls back to a safe kind and sort for unknown input', () => {
    const request = normalizePublicSearchPageRequest({ kind: 'spaceship', sort: 'random' });
    expect(request.kind).toBe('property');
    expect(request.sort).toBe('newest');
  });

  test('pins the page size so a caller cannot request the whole table', () => {
    expect(normalizePublicSearchPageRequest({ pageSize: 10000 }).pageSize).toBe(24);
  });

  test('never lets maxPrice fall below minPrice', () => {
    const request = normalizePublicSearchPageRequest({ minPrice: 5000, maxPrice: 100 });
    expect(request.maxPrice).toBeGreaterThanOrEqual(request.minPrice);
  });

  test('uses a higher default ceiling for machinery than for property', () => {
    expect(normalizePublicSearchPageRequest({ kind: 'machinery' }).maxPrice).toBe(2000000);
    expect(normalizePublicSearchPageRequest({ kind: 'property' }).maxPrice).toBe(500000);
  });

  test('truncates an over-long free-text query instead of rejecting the search', () => {
    expect(normalizePublicSearchPageRequest({ query: 'x'.repeat(500) }).query).toHaveLength(100);
  });

  test('ignores a negative price rather than inverting the range', () => {
    expect(normalizePublicSearchPageRequest({ minPrice: -100 }).minPrice).toBe(0);
  });
});

describe('search cursor is validated against the active sort', () => {
  test('a newest cursor must carry a timestamp', () => {
    expect(normalizePublicSearchCursor({ id: ID, value: '2026-01-01T00:00:00Z' }, 'newest'))
      .toEqual({ id: ID, value: '2026-01-01T00:00:00.000Z' });
    expect(() => normalizePublicSearchCursor({ id: ID, value: 'not-a-date' }, 'newest'))
      .toThrow(/cursor time is invalid/);
  });

  test('a price cursor must carry a non-negative number', () => {
    expect(normalizePublicSearchCursor({ id: ID, value: '250' }, 'price_asc'))
      .toEqual({ id: ID, value: '250' });
    expect(() => normalizePublicSearchCursor({ id: ID, value: -1 }, 'price_asc'))
      .toThrow(/cursor value is invalid/);
  });

  test('a most_viewed cursor must be a whole number of views', () => {
    expect(() => normalizePublicSearchCursor({ id: ID, value: 12.5 }, 'most_viewed'))
      .toThrow(/cursor views are invalid/);
  });

  test('rejects a cursor whose id is not a uuid', () => {
    expect(() => normalizePublicSearchCursor({ id: 'x', value: '1' }, 'price_asc'))
      .toThrow(/cursor id is invalid/);
  });

  test('a page request rejects a cursor that does not match its sort', () => {
    expect(() => normalizePublicSearchPageRequest({ sort: 'newest', cursor: { id: ID, value: 'nope' } }))
      .toThrow(/cursor time is invalid/);
  });
});
