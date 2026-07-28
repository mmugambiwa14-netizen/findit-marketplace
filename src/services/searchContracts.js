const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEARCH_KINDS = new Set(['property', 'car', 'machinery']);
const SEARCH_SORTS = new Set(['newest', 'price_asc', 'price_desc', 'most_viewed']);
const PAGE_SIZE = 24;

function text(value, maxLength = 100) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function positiveInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function baseRequest(input = {}) {
  const kind = SEARCH_KINDS.has(input.kind) ? input.kind : 'property';
  const defaultMaxPrice = kind === 'machinery' ? 2000000 : 500000;
  const minPrice = nonNegativeNumber(input.minPrice, 0);
  const maxPrice = Math.max(minPrice, nonNegativeNumber(input.maxPrice, defaultMaxPrice));
  return {
    kind,
    query: text(input.query),
    category: text(input.category, 80),
    locationId: text(input.locationId, 64),
    minPrice,
    maxPrice,
    minBedrooms: positiveInteger(input.minBedrooms),
    brand: text(input.brand, 80),
    condition: text(input.condition, 40),
    fuelType: text(input.fuelType, 40),
    transmission: text(input.transmission, 40),
    sort: SEARCH_SORTS.has(input.sort) ? input.sort : 'newest',
    pageSize: PAGE_SIZE,
  };
}

export function normalizePublicSearchCursor(value, sort) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Search cursor is invalid');
  const id = typeof value.id === 'string' ? value.id.trim().toLowerCase() : '';
  if (!UUID.test(id)) throw new TypeError('Search cursor id is invalid');

  if (sort === 'newest') {
    const date = new Date(value.value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Search cursor time is invalid');
    return { id, value: date.toISOString() };
  }

  const number = Number(value.value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError('Search cursor value is invalid');
  if (sort === 'most_viewed' && !Number.isInteger(number)) throw new TypeError('Search cursor views are invalid');
  return { id, value: String(number) };
}

// Compatibility contract for inactive offset consumers and older tests. The
// active Search page uses normalizePublicSearchPageRequest below.
export function normalizePublicSearchRequest(input = {}) {
  return {
    ...baseRequest(input),
    page: positiveInteger(input.page, 1),
    cursor: null,
  };
}

export function normalizePublicSearchPageRequest(input = {}) {
  const request = baseRequest(input);
  return {
    ...request,
    cursor: normalizePublicSearchCursor(input.cursor, request.sort),
  };
}
