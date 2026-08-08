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
import { getCategoryTaxonomy } from '@/services/taxonomyService';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

function serviceTaxonomyTermMatches(node, value) {
  if (!node || typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return node.stableSlug === normalized
    || node.canonicalSlug === normalized
    || node.aliases.includes(normalized);
}

function serviceDomainNodes(taxonomy) {
  const root = taxonomy.find((node) => (
    node.marketplaceKind === 'service'
    && node.depth === 0
    && node.nodeType === 'group'
    && !node.supersededBy
  ));
  if (!root) return [];
  return taxonomy.filter((node) => (
    node.parentId === root.id
    && node.nodeType === 'group'
    && !node.supersededBy
    && node.schemaBinding?.defaults?.service_domain === node.stableSlug
  ));
}

function serviceSpecializationNodes(taxonomy, domain) {
  if (!domain) return [];
  return taxonomy.filter((node) => (
    node.marketplaceKind === 'service'
    && node.nodeType === 'category'
    && node.isPostable
    && !node.supersededBy
    && node.depth > domain.depth
    && node.pathSlugs[domain.depth] === domain.canonicalSlug
    && node.schemaBinding?.defaults?.service_domain === domain.stableSlug
    && node.schemaBinding?.defaults?.service_specialization === node.stableSlug
  ));
}

function serviceMarketCountry(inputCountryCode) {
  const countryCode = String(inputCountryCode || LAUNCH_COUNTRY_CODE).trim().toUpperCase();
  if (countryCode !== LAUNCH_COUNTRY_CODE) {
    throw new TypeError('Service publishing is not enabled for this market');
  }
  return countryCode;
}

function humanizeTaxonomyKey(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function attachServiceTaxonomyPresentation(services, countryCode = LAUNCH_COUNTRY_CODE) {
  if (!Array.isArray(services) || services.length === 0) return services;
  let taxonomy = [];
  try {
    taxonomy = await getCategoryTaxonomy('service', countryCode);
  } catch {
    // Service data remains usable if reference-data presentation is temporarily
    // unavailable. The fallback derives only from the stored stable key; it is
    // not a competing category registry.
  }
  const byStableSlug = new Map(taxonomy.map((node) => [node.stableSlug, node]));
  return services.map((service) => {
    if (!service) return service;
    const categoryNode = byStableSlug.get(service.category);
    const subcategoryKeys = Array.isArray(service.subcategories) && service.subcategories.length
      ? service.subcategories
      : (service.subcategory ? [service.subcategory] : []);
    const subcategoryLabels = subcategoryKeys.map((key) => (
      byStableSlug.get(key)?.label || humanizeTaxonomyKey(key)
    ));
    return {
      ...service,
      category_label: categoryNode?.label || humanizeTaxonomyKey(service.category) || 'Service',
      subcategory_labels: subcategoryLabels,
      subcategory_label: subcategoryLabels[0] || null,
    };
  });
}

async function resolveServiceTaxonomySelection({ countryCode, category, subcategories = [] }) {
  const taxonomy = await getCategoryTaxonomy('service', countryCode);
  const domains = serviceDomainNodes(taxonomy);
  const domain = domains.find((node) => serviceTaxonomyTermMatches(node, category));
  if (!domain) throw new TypeError('Service category is not active in the current taxonomy');

  const specializationNodes = serviceSpecializationNodes(taxonomy, domain);
  const normalizedSubcategories = subcategories.map((value) => {
    const match = specializationNodes.find((node) => serviceTaxonomyTermMatches(node, value));
    if (!match) throw new TypeError('Service type is not active in the current taxonomy');
    return match.stableSlug;
  });

  return {
    category: domain.stableSlug,
    subcategories: normalizedSubcategories,
    allowedCategories: new Set([domain.stableSlug]),
    allowedSubcategories: new Set(specializationNodes.map((node) => node.stableSlug)),
  };
}

async function normalizeCanonicalPublicServiceRequest(request = {}) {
  if (!request.category || request.category === 'all') return normalizePublicServiceRequest(request);
  const countryCode = serviceMarketCountry(request.countryCode);
  const taxonomy = await getCategoryTaxonomy('service', countryCode);
  const domains = serviceDomainNodes(taxonomy);
  const domain = domains.find((node) => serviceTaxonomyTermMatches(node, request.category));
  if (!domain) throw new TypeError('Service category is not active in the current taxonomy');
  return normalizePublicServiceRequest(
    { ...request, category: domain.stableSlug },
    { allowedCategories: new Set(domains.map((node) => node.stableSlug)) },
  );
}

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
  const normalized = await normalizeCanonicalPublicServiceRequest(request);
  const page = createKeysetPage(await findPublicServices(normalized), normalized.limit);
  const enriched = await enrichPublicServiceCards(page.items);
  return {
    items: await attachServiceTaxonomyPresentation(enriched),
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
  const [withTaxonomy] = await attachServiceTaxonomyPresentation([withTour]);
  return withTaxonomy;
}

/**
 * @param {string[]} ids
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function getPublicServicesByIds(ids, { signal } = {}) {
  const uniqueIds = [...new Set(ids)].slice(0, 24);
  const rows = await findPublicServicesByIds(uniqueIds, { signal });
  const services = await enrichPublicServiceCards(rows, { includeTours: false });
  const presented = await attachServiceTaxonomyPresentation(services);
  const byId = new Map(presented.map((service) => [service.id, service]));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
}

export async function getOwnerServicesPage(providerId, request = {}) {
  const normalized = normalizeOwnerServicePageRequest(providerId, request);
  const page = createKeysetPage(await findOwnerServices(normalized), normalized.limit);
  const services = await Promise.all(page.items.map(mapService));
  return {
    items: await attachServiceTaxonomyPresentation(services),
    nextCursor: page.nextCursor,
  };
}

export async function getOwnerServices(providerId, limit = 30) {
  return (await getOwnerServicesPage(providerId, { limit })).items;
}

export async function createService(input, provider, uploads = []) {
  const countryCode = serviceMarketCountry(input?.country_code);
  const taxonomy = await resolveServiceTaxonomySelection({
    countryCode,
    category: input?.category,
    subcategories: Array.isArray(input?.subcategories) ? input.subcategories : [],
  });
  const normalized = normalizeServiceCreate({
    ...input,
    category: taxonomy.category,
    subcategories: taxonomy.subcategories,
  }, provider, taxonomy);
  const created = await insertOwnerService(normalized);
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
  const mapped = await mapService({ ...created, photos: uploads.map((upload) => upload.path) });
  const [presented] = await attachServiceTaxonomyPresentation([mapped], countryCode);
  return presented;
}

export async function updateService(providerId, id, input, mediaChange = null) {
  const normalizedProviderId = normalizeProviderId(providerId);
  const normalizedId = normalizeServiceId(id);
  const updated = await updateOwnerServiceRow(
    normalizedProviderId,
    normalizedId,
    normalizeServiceEdit(input),
  );
  if (!mediaChange) {
    const mapped = await mapService(updated);
    const [presented] = await attachServiceTaxonomyPresentation([mapped]);
    return presented;
  }

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
    const mapped = await mapService({ ...updated, photos: replacement?.photos ?? [] });
    const [presented] = await attachServiceTaxonomyPresentation([mapped]);
    return presented;
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
  const mapped = await mapService(await updateOwnerServiceRow(
    normalizeProviderId(providerId),
    normalizeServiceId(id),
    { status: normalizeServiceStatus(status) },
  ));
  const [presented] = await attachServiceTaxonomyPresentation([mapped]);
  return presented;
}

export async function deleteService(providerId, id) {
  const deleted = await deleteOwnerServiceRow(normalizeProviderId(providerId), normalizeServiceId(id));
  const paths = Array.isArray(deleted.photos)
    ? deleted.photos.filter((value) => typeof value === 'string' && value.includes('/service_photo/staging/'))
    : [];
  await Promise.all(paths.map((path) => removeStagedMarketplaceImage(path, 'service_photo').catch(() => {})));
  return deleted;
}
