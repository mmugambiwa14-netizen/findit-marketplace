import {
  deleteOwnerServiceRow,
  findOwnerServices,
  findPublicServiceById,
  findPublicServicesByIds,
  findPublicServices,
  insertOwnerService,
  updateOwnerServiceRow,
} from '@/repositories/servicesRepository';
import {
  normalizeOwnerServicePageRequest,
  normalizeProviderId,
  normalizePublicServiceRequest,
  normalizeServiceCreate,
  normalizeServiceEdit,
  normalizeServiceId,
  normalizeServiceStatus,
} from '@/services/serviceContracts';
import {
  attachMarketplaceImage,
  removeStagedMarketplaceImage,
  replaceServiceMedia,
  resolveMarketplaceImages,
} from '@/services/marketplaceImagesService';
import { isTrustedMarketplaceImagePath } from '@/services/marketplaceImageContracts';
import { attachPublicTourSummaries } from '@/services/listingToursService';
import { enrichPublicServiceCards } from '@/services/serviceCardEnrichmentService';
import { createKeysetPage } from '@/services/keysetPagination';

async function mapService(row) {
  if (!row) return null;
  const photoPaths = Array.isArray(row.photos) ? row.photos : [];
  const trustedPhotoPaths = photoPaths.filter((value) => isTrustedMarketplaceImagePath(value, 'service_photo'));
  return {
    ...row,
    price: row.price == null ? null : Number(row.price),
    photo_paths: trustedPhotoPaths,
    has_legacy_media: photoPaths.some((value) => !isTrustedMarketplaceImagePath(value, 'service_photo')),
    photos: await resolveMarketplaceImages(photoPaths, 'service_photo'),
    subcategories: Array.isArray(row.subcategories) ? row.subcategories : [],
  };
}

export async function getPublicServicesPage(request = {}) {
  const normalized = normalizePublicServiceRequest(request);
  const page = createKeysetPage(await findPublicServices(normalized), normalized.limit);
  return {
    items: await enrichPublicServiceCards(page.items),
    nextCursor: page.nextCursor,
  };
}

export async function getPublicServices(request = {}) {
  return (await getPublicServicesPage(request)).items;
}

export async function getPublicService(id) {
  const service = await mapService(await findPublicServiceById(normalizeServiceId(id)));
  if (!service) return null;
  const [withTour] = await attachPublicTourSummaries([service], 'service');
  return withTour;
}

/**
 * @param {string[]} ids
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function getPublicServicesByIds(ids, { signal } = {}) {
  const uniqueIds = [...new Set(ids)].slice(0, 24);
  const rows = await findPublicServicesByIds(uniqueIds, { signal });
  const services = await enrichPublicServiceCards(rows, { includeTours: false });
  const byId = new Map(services.map((service) => [service.id, service]));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
}

export async function getOwnerServicesPage(providerId, request = {}) {
  const normalized = normalizeOwnerServicePageRequest(providerId, request);
  const page = createKeysetPage(await findOwnerServices(normalized), normalized.limit);
  return {
    items: await Promise.all(page.items.map(mapService)),
    nextCursor: page.nextCursor,
  };
}

export async function getOwnerServices(providerId, limit = 30) {
  return (await getOwnerServicesPage(providerId, { limit })).items;
}

export async function createService(input, provider, uploads = []) {
  const created = await insertOwnerService(normalizeServiceCreate(input, provider));
  try {
    for (const [displayOrder, upload] of uploads.entries()) {
      await attachMarketplaceImage({
        ...upload,
        purpose: 'service_photo',
        targetKind: 'service',
        targetId: created.id,
        displayOrder,
      });
    }
  } catch (error) {
    await deleteOwnerServiceRow(provider.id, created.id).catch(() => {});
    await Promise.all(uploads.map((upload) => (
      removeStagedMarketplaceImage(upload.path, 'service_photo').catch(() => {})
    )));
    throw error;
  }
  return await mapService({ ...created, photos: uploads.map((upload) => upload.path) });
}

export async function updateService(providerId, id, input, mediaChange = null) {
  const normalizedProviderId = normalizeProviderId(providerId);
  const normalizedId = normalizeServiceId(id);
  const updated = await updateOwnerServiceRow(
    normalizedProviderId,
    normalizedId,
    normalizeServiceEdit(input),
  );
  if (!mediaChange) return await mapService(updated);

  const uploads = Array.isArray(mediaChange.uploads) ? mediaChange.uploads : [];
  try {
    const replacement = await replaceServiceMedia(
      normalizedId,
      mediaChange.keepPaths,
      uploads,
    );
    const removedPaths = Array.isArray(replacement?.removedPaths) ? replacement.removedPaths : [];
    await Promise.all(removedPaths.map((path) => (
      removeStagedMarketplaceImage(path, 'service_photo').catch(() => {})
    )));
    return await mapService({ ...updated, photos: replacement?.photos ?? [] });
  } catch (error) {
    await Promise.all(uploads.map((upload) => (
      removeStagedMarketplaceImage(upload.path, 'service_photo').catch(() => {})
    )));
    const partial = Object.assign(
      new Error('Service details were saved, but image changes could not be applied. Reload and try the images again.'),
      { cause: error, partial: true },
    );
    throw partial;
  }
}

export async function setServiceStatus(providerId, id, status) {
  return await mapService(await updateOwnerServiceRow(
    normalizeProviderId(providerId),
    normalizeServiceId(id),
    { status: normalizeServiceStatus(status) },
  ));
}

export async function deleteService(providerId, id) {
  const deleted = await deleteOwnerServiceRow(normalizeProviderId(providerId), normalizeServiceId(id));
  const paths = Array.isArray(deleted.photos)
    ? deleted.photos.filter((value) => typeof value === 'string' && value.includes('/service_photo/staging/'))
    : [];
  await Promise.all(paths.map((path) => removeStagedMarketplaceImage(path, 'service_photo').catch(() => {})));
  return deleted;
}
