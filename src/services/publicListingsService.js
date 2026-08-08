import {
  findLatestAvailableListings,
  findPublicListingById,
  findPublicListingsByIds,
  findPublicListingTitleSuggestions,
  findPublicListingsPage,
} from '@/repositories/publicListingsRepository';
import { findActiveLocationSuggestions } from '@/repositories/locationsRepository';
import { mapPublicListing } from '@/services/listingMappers';
import { hydrateListingImages } from '@/services/listingCreationService';
import { enrichPublicListingCards } from '@/services/listingCardEnrichmentService';
import { normalizePublicSearchPageRequest, normalizePublicSearchRequest } from '@/services/searchContracts';
import { attachPublicTourSummaries } from '@/services/listingToursService';
import {
  filterLocalPreviewListings,
  findLocalPreviewListing,
  findLocalPreviewSuggestions,
  localPreviewListingsEnabled,
  paginateLocalPreviewListings,
} from '@/services/localPreviewListings';

const MAX_HOME_RESULTS = 24;
const MAX_RECOMMENDATION_RESULTS = 24;

function normalizeListingIds(listingIds) {
  if (!Array.isArray(listingIds)) return [];
  const unique = [];
  const seen = new Set();
  for (const value of listingIds) {
    if (
      typeof value !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      || seen.has(value)
    ) continue;
    seen.add(value);
    unique.push(value);
    if (unique.length === MAX_RECOMMENDATION_RESULTS) break;
  }
  return unique;
}

function normalizeLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HOME_RESULTS) {
    throw new RangeError(`Listing limit must be between 1 and ${MAX_HOME_RESULTS}`);
  }
  return limit;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
}

export async function getLatestPublicListings(kind, limit) {
  if (localPreviewListingsEnabled()) {
    const rows = filterLocalPreviewListings({
      kind,
      query: '',
      category: '',
      locationId: '',
      minPrice: 0,
      maxPrice: Number.MAX_SAFE_INTEGER,
      minBedrooms: null,
      brand: '',
      condition: '',
      fuelType: '',
      transmission: '',
      sort: 'newest',
    }).slice(0, normalizeLimit(limit));
    return attachPublicTourSummaries(rows.map(mapPublicListing), 'listing');
  }
  const rows = await findLatestAvailableListings(kind, normalizeLimit(limit));
  return enrichPublicListingCards(rows);
}

export async function getPublicListing(kind, id) {
  if (typeof id !== 'string' || !id.trim()) return null;
  if (localPreviewListingsEnabled()) {
    const row = findLocalPreviewListing(kind, id);
    if (!row) return null;
    const [listing] = await attachPublicTourSummaries([mapPublicListing(row)], 'listing');
    return listing;
  }
  const row = await findPublicListingById(kind, id);
  if (!row) return null;
  const [hydrated] = await hydrateListingImages([row]);
  const listing = mapPublicListing(hydrated);
  const [withTour] = await attachPublicTourSummaries([listing], 'listing');
  return withTour;
}

/**
 * @param {unknown[]} listingIds
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function getPublicListingsByIds(listingIds, { signal } = {}) {
  const ids = normalizeListingIds(listingIds);
  if (ids.length === 0) return [];
  throwIfAborted(signal);

  if (localPreviewListingsEnabled()) {
    const listings = ids.flatMap((id) => (
      ['property', 'car', 'machinery']
        .map((kind) => findLocalPreviewListing(kind, id))
        .filter(Boolean)
        .slice(0, 1)
    ));
    const mapped = listings.map(mapPublicListing);
    const byId = new Map(mapped.map((listing) => [listing.id, listing]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  const rows = await findPublicListingsByIds(ids, signal);
  throwIfAborted(signal);
  const enriched = await enrichPublicListingCards(rows);
  throwIfAborted(signal);
  const byId = new Map(enriched.map((listing) => [listing.id, listing]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * @param {object} input
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function searchPublicListingsPage(input, { signal } = {}) {
  const request = normalizePublicSearchPageRequest(input);
  throwIfAborted(signal);
  if (localPreviewListingsEnabled()) {
    // Preview fixtures are intentionally USD-only. Preserve truthful currency
    // behavior instead of relabeling fixture amounts as another currency.
    if (request.currency && request.currency !== 'USD') {
      return { items: [], nextCursor: null };
    }
    const page = paginateLocalPreviewListings({
      ...request,
      minPrice: request.minPrice ?? 0,
      maxPrice: request.maxPrice ?? Number.MAX_SAFE_INTEGER,
    });
    return {
      items: await attachPublicTourSummaries(
        page.items.map(mapPublicListing),
        'listing',
      ),
      nextCursor: page.nextCursor,
    };
  }
  const rows = await findPublicListingsPage(request, signal);
  throwIfAborted(signal);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.pageSize;
  const pageRows = values.slice(0, request.pageSize);
  const cursorRow = hasMore ? pageRows.at(-1) : null;
  const cleanRows = pageRows.map(({ cursor_value: _cursorValue, ...row }) => row);
  const items = await enrichPublicListingCards(cleanRows);
  throwIfAborted(signal);

  return {
    items,
    nextCursor: cursorRow ? { value: cursorRow.cursor_value, id: cursorRow.id } : null,
  };
}

/**
 * @param {string} kind
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function getPublicSearchSuggestions(kind, query, { signal } = {}) {
  const normalized = normalizePublicSearchRequest({ kind, query });
  if (normalized.query.length < 2) return { listings: [], locations: [] };
  throwIfAborted(signal);
  if (localPreviewListingsEnabled()) {
    return findLocalPreviewSuggestions(normalized.kind, normalized.query);
  }

  const [listings, locations] = await Promise.all([
    findPublicListingTitleSuggestions(normalized.kind, normalized.query, 5, signal),
    findActiveLocationSuggestions(normalized.query, { signal }),
  ]);
  throwIfAborted(signal);
  return { listings, locations };
}

export const searchPublicListings = searchPublicListingsPage;
