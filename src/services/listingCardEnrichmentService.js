import { hydrateListingCardImages } from '@/services/listingCreationService';
import { mapPublicListing } from '@/services/listingMappers';
import { attachPublicTourSummaries } from '@/services/listingToursService';

/**
 * Builds the public card projection with the two independent remote enrichments
 * running in parallel: one batched cover-image signing request and one batched
 * Peek summary request. Detail pages intentionally use the full media boundary
 * instead.
 */
export async function enrichPublicListingCards(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (source.length === 0) return [];

  const baseListings = source.map(mapPublicListing);
  const [hydratedRows, tourListings] = await Promise.all([
    hydrateListingCardImages(source),
    attachPublicTourSummaries(baseListings, 'listing'),
  ]);
  const tourById = new Map(tourListings.map((listing) => [listing.id, listing.tour ?? null]));

  return hydratedRows.map(mapPublicListing).map((listing) => ({
    ...listing,
    tour: tourById.get(listing.id) ?? null,
  }));
}
