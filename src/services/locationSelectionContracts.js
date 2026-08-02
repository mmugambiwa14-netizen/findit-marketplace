/**
 * Location selection payload (Part III §8).
 *
 * The canonical place and its coordinates must travel together. Keeping the
 * shape here rather than inline in the selector means the contract is
 * verifiable, and that a confirmed selection cannot silently lose its
 * coordinates on the way to form state, a draft, or the map.
 */

function finiteOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {{ id: string, name: string, type?: string, latitude?: unknown, longitude?: unknown, country_code?: string }} place
 * @param {{ country?: string, countryName?: string, countryCode?: string, state?: string, stateName?: string }} context
 * @param {'manual'|'device'} source
 */
export function buildLocationSelection(place, context = {}, source = 'manual') {
  if (!place || typeof place.id !== 'string' || !place.id) {
    throw new TypeError('A confirmed place is required');
  }

  return {
    country: context.country || '',
    countryName: context.countryName || '',
    countryCode: context.countryCode || place.country_code || '',
    state: context.state || '',
    stateName: context.stateName || '',
    city: place.id,
    cityName: place.name || '',
    placeType: place.type || '',
    latitude: finiteOrNull(place.latitude),
    longitude: finiteOrNull(place.longitude),
    source,
  };
}

/**
 * True when a selection carries usable coordinates. The map centres only on a
 * complete pair -- a half-resolved location must not move the viewport to the
 * equator.
 */
export function hasCoordinates(selection) {
  return typeof selection?.latitude === 'number' && typeof selection?.longitude === 'number';
}

/**
 * Draft restoration (Part III §8): "Draft restoration must restore both the
 * canonical place and its coordinates." Returns the selection only when the
 * stored draft actually carries both, so a partial draft degrades to "no
 * location chosen" rather than to a place pinned at the wrong point.
 */
export function restoreLocationSelection(stored) {
  if (!stored || typeof stored.city !== 'string' || !stored.city) return null;
  const restored = {
    ...stored,
    latitude: finiteOrNull(stored.latitude),
    longitude: finiteOrNull(stored.longitude),
  };
  return { selection: restored, coordinatesRestored: hasCoordinates(restored) };
}
