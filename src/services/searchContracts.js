const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import { LAUNCH_COUNTRY_CODE } from '../lib/marketConfig.js';
const SEARCH_KINDS = new Set(['property', 'car', 'machinery']);
const SEARCH_SORTS = new Set(['newest', 'price_asc', 'price_desc', 'most_viewed']);
const SEARCH_CURRENCIES = new Set(['USD', 'ZWL', 'ZAR']);
const PAGE_SIZE = 24;

function text(value, maxLength = 100) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function positiveInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function optionalNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function baseRequest(input = {}) {
  const kind = SEARCH_KINDS.has(input.kind) ? input.kind : 'property';
  // The public launch surface is Zimbabwe-only. Country records remain in the
  // database for future markets, but URL/query tampering cannot switch this
  // public search to another country.
  const countryCode = LAUNCH_COUNTRY_CODE;
  const requestedCurrency = text(input.currency, 3).toUpperCase();
  const currency = SEARCH_CURRENCIES.has(requestedCurrency) ? requestedCurrency : '';
  const minPrice = currency ? optionalNonNegativeNumber(input.minPrice) : null;
  let maxPrice = currency ? optionalNonNegativeNumber(input.maxPrice) : null;
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) maxPrice = minPrice;
  const requestedSort = SEARCH_SORTS.has(input.sort) ? input.sort : 'newest';
  const sort = !currency && (requestedSort === 'price_asc' || requestedSort === 'price_desc')
    ? 'newest'
    : requestedSort;

  return {
    kind,
    countryCode,
    currency,
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
    sort,
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
