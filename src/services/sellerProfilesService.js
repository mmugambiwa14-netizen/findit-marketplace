import { findPublicSellerListings } from '@/repositories/publicListingsRepository';
import { findPublicSellerProfile } from '@/repositories/sellerProfilesRepository';
import { enrichPublicListingCards } from '@/services/listingCardEnrichmentService';
import { normalizeSellerListingsPageRequest, normalizeSellerProfileId } from '@/services/sellerProfileContracts';
import { createKeysetPage } from '@/services/keysetPagination';
import { resolveMarketplaceImage } from '@/services/marketplaceImagesService';

function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function getPublicSellerProfile(sellerId) {
  const profile = await findPublicSellerProfile(normalizeSellerProfileId(sellerId));
  if (!profile) return null;
  return {
    ...profile,
    avatar_url: profile.avatar_storage_path
      ? await resolveMarketplaceImage(profile.avatar_storage_path, 'seller_logo')
      : safeHttpUrl(profile.avatar_url),
    website_url: safeHttpUrl(profile.website_url),
  };
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
