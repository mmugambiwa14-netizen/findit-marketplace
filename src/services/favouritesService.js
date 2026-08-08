import {
  deleteFavourite,
  findFavourite,
  findFavouriteListingIds,
  findFavouriteRows,
  insertFavourite,
} from '@/repositories/favouritesRepository';
import { findSavedListingsByIds } from '@/repositories/publicListingsRepository';
import { enrichPublicListingCards } from '@/services/listingCardEnrichmentService';
import { createKeysetPage, normalizeKeysetCursor, normalizePageLimit } from '@/services/keysetPagination';

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

export function getFavourite(userId, listingId) {
  return findFavourite(requireId(userId, 'User id'), requireId(listingId, 'Listing id'));
}

export function getFavouriteIds(userId, listingIds) {
  requireId(userId, 'User id');
  const ids = Array.isArray(listingIds)
    ? listingIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  return findFavouriteListingIds(userId, [...new Set(ids)]);
}

export function addFavourite(userId, listingId) {
  return insertFavourite(requireId(userId, 'User id'), requireId(listingId, 'Listing id'));
}

export function removeFavourite(userId, listingId) {
  return deleteFavourite(requireId(userId, 'User id'), requireId(listingId, 'Listing id'));
}

export function normalizeFavouriteListRequest(userId, input = {}) {
  const request = typeof input === 'number' ? { limit: input } : (input || {});
  return {
    userId: requireId(userId, 'User id'),
    limit: normalizePageLimit(request.limit, { fallback: 30, maximum: 60 }),
    cursor: normalizeKeysetCursor(request.cursor),
  };
}

export async function getFavouriteListingsPage(userId, input = {}) {
  const request = normalizeFavouriteListRequest(userId, input);
  const page = createKeysetPage(await findFavouriteRows(request), request.limit);
  const listingIds = page.items.map((row) => row.listing_id);
  const listings = await enrichPublicListingCards(await findSavedListingsByIds(listingIds));
  const byId = new Map(listings.map((row) => [row.id, row]));
  return {
    items: page.items.map((row) => byId.get(row.listing_id)).filter(Boolean),
    nextCursor: page.nextCursor,
  };
}

export async function getFavouriteListings(userId, limit = 30) {
  return (await getFavouriteListingsPage(userId, { limit })).items;
}
