import {
  deleteServiceFavourite,
  findServiceFavourite,
  findServiceFavouriteIds,
  findServiceFavouriteRows,
  insertServiceFavourite,
} from '@/repositories/serviceFavouritesRepository';
import { getPublicServicesByIds } from '@/services/servicesService';
import { createKeysetPage, normalizeKeysetCursor, normalizePageLimit } from '@/services/keysetPagination';

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value.trim();
}

export function getServiceFavourite(userId, serviceId) {
  return findServiceFavourite(requireId(userId, 'User id'), requireId(serviceId, 'Service id'));
}

export function getServiceFavouriteIds(userId, serviceIds) {
  requireId(userId, 'User id');
  const ids = Array.isArray(serviceIds)
    ? serviceIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  return findServiceFavouriteIds(userId, [...new Set(ids)]);
}

export function addServiceFavourite(userId, serviceId) {
  return insertServiceFavourite(requireId(userId, 'User id'), requireId(serviceId, 'Service id'));
}

export function removeServiceFavourite(userId, serviceId) {
  return deleteServiceFavourite(requireId(userId, 'User id'), requireId(serviceId, 'Service id'));
}

export function normalizeServiceFavouriteListRequest(userId, input = {}) {
  const request = typeof input === 'number' ? { limit: input } : (input || {});
  return {
    userId: requireId(userId, 'User id'),
    limit: normalizePageLimit(request.limit, { fallback: 30, maximum: 60 }),
    cursor: normalizeKeysetCursor(request.cursor),
  };
}

export async function getFavouriteServicesPage(userId, input = {}) {
  const request = normalizeServiceFavouriteListRequest(userId, input);
  const page = createKeysetPage(await findServiceFavouriteRows(request), request.limit);
  const serviceIds = page.items.map((row) => row.service_id);
  const services = await getPublicServicesByIds(serviceIds);
  const byId = new Map(services.map((service) => [service.id, service]));
  return {
    items: page.items.map((row) => byId.get(row.service_id)).filter(Boolean),
    nextCursor: page.nextCursor,
  };
}

export async function getFavouriteServices(userId, limit = 30) {
  return (await getFavouriteServicesPage(userId, { limit })).items;
}
