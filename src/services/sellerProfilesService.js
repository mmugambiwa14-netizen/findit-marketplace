import { findPublicSellerListings } from '@/repositories/publicListingsRepository';
import { findPublicSellerProfile } from '@/repositories/sellerProfilesRepository';
import { enrichPublicListingCards } from '@/services/listingCardEnrichmentService';
import { normalizeSellerListingsPageRequest, normalizeSellerProfileId } from '@/services/sellerProfileContracts';
import { createKeysetPage } from '@/services/keysetPagination';

export async function getPublicSellerProfile(sellerId) {
  return findPublicSellerProfile(normalizeSellerProfileId(sellerId));
}

export async function getPublicSellerListingsPage(sellerId, input = {}) {
  const request = normalizeSellerListingsPageRequest(sellerId, input);
  const page = createKeysetPage(await findPublicSellerListings(request), request.limit);
  return {
    items: await enrichPublicListingCards(page.items),
    nextCursor: page.nextCursor,
  };
}

export async function getPublicSellerPage(sellerId) {
  const profile = await getPublicSellerProfile(sellerId);
  if (!profile) return null;
  const page = await getPublicSellerListingsPage(profile.id);
  return { profile, listings: page.items, nextCursor: page.nextCursor };
}
