import { findActiveLocations } from '@/repositories/locationsRepository';

const SUPPORTED_TYPES = new Set(['country', 'province', 'city', 'town', 'district']);

export async function getActiveLocations(type, parentId = null) {
  if (!SUPPORTED_TYPES.has(type)) {
    throw new TypeError(`Unsupported location type: ${type}`);
  }

  const rows = await findActiveLocations({ type, parentId });
  return rows.map((row) => ({
    ...row,
    coordinates: {
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    },
  }));
}
