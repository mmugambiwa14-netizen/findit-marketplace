import { findPublicSellerListings } from '@/repositories/publicListingsRepository';
import { findPublicSellerProfile } from '@/repositories/sellerProfilesRepository';
import { mapPublicListing } from '@/services/listingMappers';
import { hydrateListingImages } from '@/services/listingCreationService';
import { normalizeSellerListingsPageRequest, normalizeSellerProfileEmail } from '@/services/sellerProfileContracts';
import { attachPublicTourSummaries } from '@/services/listingToursService';
import { createKeysetPage } from '@/services/keysetPagination';

export async function getPublicSellerProfile(email) {
  return findPublicSellerProfile(normalizeSellerProfileEmail(email));
}

export async function getPublicSellerListingsPage(sellerId, input = {}) {
  const request = normalizeSellerListingsPageRequest(sellerId, input);
  const page = createKeysetPage(await findPublicSellerListings(request), request.limit);
  const listingRows = await hydrateListingImages(page.items);
  return {
    items: await attachPublicTourSummaries(listingRows.map(mapPublicListing), 'listing'),
    nextCursor: page.nextCursor,
  };
}

export async function getPublicSellerPage(email) {
  const profile = await getPublicSellerProfile(email);
  if (!profile) return null;
  const page = await getPublicSellerListingsPage(profile.id);
  return { profile, listings: page.items, nextCursor: page.nextCursor };
}
