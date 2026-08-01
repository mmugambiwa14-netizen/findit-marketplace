import {
  findActiveLocations,
  findMarketplaceLocationHierarchy,
  resolveNearestMarketplacePlace,
  searchActiveMarketplacePlaces,
} from '@/repositories/locationsRepository';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

const SUPPORTED_TYPES = new Set(['country', 'region', 'state', 'province', 'county', 'city', 'town', 'district', 'suburb', 'neighbourhood', 'village']);

function withCoordinates(row) {
  return {
    ...row,
    coordinates: {
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
  };
}

export async function getActiveLocations(
  type,
  parentId = null,
  countryCode = type === 'country' ? null : LAUNCH_COUNTRY_CODE,
) {
  if (!SUPPORTED_TYPES.has(type)) {
    throw new TypeError(`Unsupported location type: ${type}`);
  }

  const rows = await findActiveLocations({ type, parentId, countryCode });
  return rows.map(withCoordinates);
}

export async function searchMarketplacePlaces(parentId, searchTerm = '', { limit = 30 } = {}) {
  if (typeof parentId !== 'string' || !parentId) throw new TypeError('A province or state is required');
  const normalizedTerm = String(searchTerm || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
  const rows = await searchActiveMarketplacePlaces({ parentId, searchTerm: normalizedTerm, limit });
  return rows.map(withCoordinates);
}

export async function getMarketplaceLocationHierarchy(locationId) {
  if (typeof locationId !== 'string' || !locationId) return null;
  return findMarketplaceLocationHierarchy(locationId);
}

export async function getNearestMarketplacePlace({ latitude, longitude }) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) throw new TypeError('Latitude is invalid');
  if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) throw new TypeError('Longitude is invalid');
  return resolveNearestMarketplacePlace({ latitude: parsedLatitude, longitude: parsedLongitude });
}
