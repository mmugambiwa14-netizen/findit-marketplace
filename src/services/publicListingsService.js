import {
  findLatestAvailableListings,
  findPublicListingById,
  findPublicListingTitleSuggestions,
  findPublicListingsPage,
} from '@/repositories/publicListingsRepository';
import { findActiveLocationSuggestions } from '@/repositories/locationsRepository';
import { mapPublicListing } from '@/services/listingMappers';
import { hydrateListingImages } from '@/services/listingCreationService';
import { normalizePublicSearchPageRequest, normalizePublicSearchRequest } from '@/services/searchContracts';
import { attachPublicTourSummaries } from '@/services/listingToursService';
import {
  filterLocalPreviewListings,
  findLocalPreviewListing,
  findLocalPreviewSuggestions,
  localPreviewListingsEnabled,
} from '@/services/localPreviewListings';

const MAX_HOME_RESULTS = 24;

function normalizeLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HOME_RESULTS) {
    throw new RangeError(`Listing limit must be between 1 and ${MAX_HOME_RESULTS}`);
  }
  return limit;
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
  const listings = (await hydrateListingImages(rows)).map(mapPublicListing);
  return await attachPublicTourSummaries(listings, 'listing');
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

export async function searchPublicListingsPage(input) {
  const request = normalizePublicSearchPageRequest(input);
  if (localPreviewListingsEnabled()) {
    if (request.cursor) return { items: [], nextCursor: null };
    return {
      items: await attachPublicTourSummaries(
        filterLocalPreviewListings(request).slice(0, request.pageSize).map(mapPublicListing),
        'listing',
      ),
      nextCursor: null,
    };
  }
  const rows = await findPublicListingsPage(request);
  const values = Array.isArray(rows) ? rows : [];
  const hasMore = values.length > request.pageSize;
  const pageRows = values.slice(0, request.pageSize);
  const cursorRow = hasMore ? pageRows.at(-1) : null;
  const cleanRows = pageRows.map(({ cursor_value: _cursorValue, ...row }) => row);

  return {
    items: await attachPublicTourSummaries((await hydrateListingImages(cleanRows)).map(mapPublicListing), 'listing'),
    nextCursor: cursorRow ? { value: cursorRow.cursor_value, id: cursorRow.id } : null,
  };
}

export async function getPublicSearchSuggestions(kind, query) {
  const normalized = normalizePublicSearchRequest({ kind, query });
  if (normalized.query.length < 2) return { listings: [], locations: [] };
  if (localPreviewListingsEnabled()) {
    return findLocalPreviewSuggestions(normalized.kind, normalized.query);
  }

  const [listings, locations] = await Promise.all([
    findPublicListingTitleSuggestions(normalized.kind, normalized.query),
    findActiveLocationSuggestions(normalized.query),
  ]);
  return { listings, locations };
}

export const searchPublicListings = searchPublicListingsPage;
