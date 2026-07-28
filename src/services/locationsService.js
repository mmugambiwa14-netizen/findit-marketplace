import { findActiveLocations } from '@/repositories/locationsRepository';

const SUPPORTED_TYPES = new Set(['country', 'region', 'state', 'province', 'county', 'city', 'town', 'district', 'suburb', 'neighbourhood', 'village']);

export async function getActiveLocations(type, parentId = null, countryCode = 'ZW') {
  if (!SUPPORTED_TYPES.has(type)) {
    throw new TypeError(`Unsupported location type: ${type}`);
  }

  const rows = await findActiveLocations({ type, parentId, countryCode });
  return rows.map((row) => ({
    ...row,
    coordinates: {
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
  }));
}
