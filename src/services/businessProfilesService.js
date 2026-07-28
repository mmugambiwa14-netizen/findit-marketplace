import {
  findOwnerBusinessProfile,
  findPublicBusinessInventory,
  findPublicBusinessProfile,
  findPublicBusinessServices,
  insertOwnerBusinessProfile,
  updateOwnerBusinessProfile,
} from '@/repositories/businessProfilesRepository';
import {
  normalizeBusinessInventoryPageRequest,
  normalizeBusinessOwnerId,
  normalizeBusinessProfileId,
  normalizeBusinessProfileInput,
  normalizeBusinessServicesPageRequest,
  normalizeDealerInventoryQuery,
} from '@/services/businessProfileContracts';
import { mapPublicListing } from '@/services/listingMappers';
import { hydrateListingImages } from '@/services/listingCreationService';
import {
  attachMarketplaceImage,
  detachMarketplaceImage,
  removeStagedMarketplaceImage,
  resolveMarketplaceImage,
  resolveMarketplaceImages,
} from '@/services/marketplaceImagesService';
import { attachPublicTourSummaries } from '@/services/listingToursService';
import { createKeysetPage } from '@/services/keysetPagination';

function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function mapProfile(row) {
  if (!row) return null;
  const socialLinks = {};
  for (const [key, value] of Object.entries(row.social_links ?? {})) {
    const url = safeHttpUrl(value);
    if (url) socialLinks[key] = url;
  }
  return {
    ...row,
    avatar_url: row.avatar_storage_path
      ? await resolveMarketplaceImage(row.avatar_storage_path, 'business_logo')
      : safeHttpUrl(row.avatar_url),
    website: safeHttpUrl(row.website),
    social_links: socialLinks,
    public_path: `${row.profile_type === 'dealer' ? '/dealer' : '/business'}/${row.id}`,
  };
}

async function mapService(row) {
  return {
    ...row,
    price: row.price == null ? null : Number(row.price),
    photo_paths: Array.isArray(row.photos)
      ? row.photos.filter((value) => typeof value === 'string' && value.includes('/service_photo/staging/'))
      : [],
    photos: await resolveMarketplaceImages(row.photos, 'service_photo'),
  };
}

export async function getOwnerBusinessProfile(ownerId) {
  return await mapProfile(await findOwnerBusinessProfile(normalizeBusinessOwnerId(ownerId)));
}

export async function saveOwnerBusinessProfile(ownerId, profileId, input, logoChange = {}) {
  const normalizedOwnerId = normalizeBusinessOwnerId(ownerId);
  const updates = normalizeBusinessProfileInput(input);
  let profile;
  if (profileId) {
    profile = await updateOwnerBusinessProfile(
      normalizedOwnerId,
      normalizeBusinessProfileId(profileId),
      updates,
    );
  } else {
    profile = await insertOwnerBusinessProfile({ ...updates, user_id: normalizedOwnerId });
  }

  if (logoChange.upload) {
    try {
      const attached = await attachMarketplaceImage({
        ...logoChange.upload,
        purpose: 'business_logo',
        targetKind: 'business',
        targetId: profile.id,
        displayOrder: 0,
      });
      if (attached.previousPath && attached.previousPath !== attached.path) {
        await removeStagedMarketplaceImage(attached.previousPath, 'business_logo');
      }
    } catch (error) {
      await removeStagedMarketplaceImage(logoChange.upload.path, 'business_logo').catch(() => {});
      throw Object.assign(
        new Error('Profile details were saved, but the logo could not be attached.'),
        { cause: error, profileSaved: true },
      );
    }
  } else if (logoChange.removeExisting && profile.avatar_storage_path) {
    await detachMarketplaceImage('business', profile.id, profile.avatar_storage_path);
  }

  return getOwnerBusinessProfile(normalizedOwnerId);
}

export async function getPublicBusinessProfile(profileId) {
  return mapProfile(await findPublicBusinessProfile(normalizeBusinessProfileId(profileId)));
}

export async function getPublicBusinessInventoryPage(ownerId, input = {}) {
  const request = normalizeBusinessInventoryPageRequest(ownerId, input);
  const page = createKeysetPage(await findPublicBusinessInventory(request), request.limit);
  const mapped = (await hydrateListingImages(page.items)).map(mapPublicListing);
  return {
    items: await attachPublicTourSummaries(mapped, 'listing'),
    nextCursor: page.nextCursor,
  };
}

export async function getPublicBusinessServicesPage(ownerId, input = {}) {
  const request = normalizeBusinessServicesPageRequest(ownerId, input);
  const page = createKeysetPage(await findPublicBusinessServices(request), request.limit);
  const mapped = await Promise.all(page.items.map(mapService));
  return {
    items: await attachPublicTourSummaries(mapped, 'service'),
    nextCursor: page.nextCursor,
  };
}

export async function getPublicBusinessProfilePage(profileId, inventoryQuery = '') {
  const profile = await getPublicBusinessProfile(profileId);
  if (!profile) return null;
  const dealerOnly = profile.profile_type === 'dealer';
  const query = dealerOnly ? normalizeDealerInventoryQuery(inventoryQuery) : '';
  const [inventoryPage, servicesPage] = await Promise.all([
    getPublicBusinessInventoryPage(profile.user_id, { dealerOnly, query }),
    dealerOnly ? Promise.resolve({ items: [], nextCursor: null }) : getPublicBusinessServicesPage(profile.user_id),
  ]);
  return {
    profile,
    inventory: inventoryPage.items,
    inventoryNextCursor: inventoryPage.nextCursor,
    services: servicesPage.items,
    servicesNextCursor: servicesPage.nextCursor,
    query,
  };
}
