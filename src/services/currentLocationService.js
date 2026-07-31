import { getActiveLocations } from '@/services/locationsService';
import { reverseGeocodeMapTiler } from '@/lib/mapProvider';

const GEOLOCATION_TIMEOUT_MS = 12_000;
const MAX_NEAREST_CITY_KM = 120;

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:city|town|municipality|province|state|district)\s+of\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function featureNames(features) {
  const values = new Set();
  for (const feature of features || []) {
    for (const value of [feature?.text, feature?.place_name]) {
      const normalized = normalizeName(value);
      if (normalized) values.add(normalized);
    }
    for (const context of feature?.context || []) {
      for (const value of [context?.text, context?.place_name]) {
        const normalized = normalizeName(value);
        if (normalized) values.add(normalized);
      }
    }
  }
  return values;
}

function positionFromBrowser() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        const code = error?.code === 1
          ? 'GEOLOCATION_PERMISSION_DENIED'
          : error?.code === 3
            ? 'GEOLOCATION_TIMEOUT'
            : 'GEOLOCATION_UNAVAILABLE';
        reject(new Error(code));
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: GEOLOCATION_TIMEOUT_MS },
    );
  });
}

function radians(value) {
  return Number(value) * Math.PI / 180;
}

function distanceKm(left, right) {
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const latitude1 = radians(left.latitude);
  const latitude2 = radians(right.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestGeocodedCity(cities, coordinates) {
  let nearest = null;
  for (const city of cities) {
    const latitude = Number(city.latitude ?? city.coordinates?.latitude);
    const longitude = Number(city.longitude ?? city.coordinates?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distance = distanceKm(coordinates, { latitude, longitude });
    if (!nearest || distance < nearest.distanceKm) nearest = { city, distanceKm: distance };
  }
  return nearest && nearest.distanceKm <= MAX_NEAREST_CITY_KM ? nearest.city : null;
}

function locationByNames(locations, names) {
  return locations.find((location) => {
    const name = normalizeName(location.name);
    return name && [...names].some((candidate) => candidate === name || candidate.startsWith(`${name} `));
  }) || null;
}

function resolvePublicHierarchy(city, countries, provinces) {
  const province = provinces.find((candidate) => candidate.id === city.parent_id) || null;
  const country = countries.find((candidate) => candidate.id === province?.parent_id)
    || countries.find((candidate) => String(candidate.country_code || candidate.code || '').toUpperCase() === 'ZW')
    || countries.find((candidate) => normalizeName(candidate.name) === 'zimbabwe')
    || null;
  if (!country || !province) throw new Error('CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET');
  return Object.freeze({
    country: country.id,
    state: province.id,
    city: city.id,
    cityName: city.name,
    source: 'device',
  });
}

export async function resolveCurrentMarketplaceLocation() {
  const position = await positionFromBrowser();
  const coordinates = {
    latitude: Number(position.coords.latitude),
    longitude: Number(position.coords.longitude),
  };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), GEOLOCATION_TIMEOUT_MS);

  try {
    const [features, countries, provinces, cities] = await Promise.all([
      reverseGeocodeMapTiler({ ...coordinates, signal: controller.signal }),
      getActiveLocations('country'),
      getActiveLocations('province'),
      getActiveLocations('city'),
    ]);
    const names = featureNames(features);
    const city = locationByNames(cities, names) || nearestGeocodedCity(cities, coordinates);
    if (!city) throw new Error('CURRENT_LOCATION_NOT_MAPPED');
    return resolvePublicHierarchy(city, countries, provinces);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('MAP_PROVIDER_TIMEOUT');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function currentLocationErrorMessage(error) {
  switch (error?.message) {
    case 'GEOLOCATION_PERMISSION_DENIED':
      return 'Location access was declined. Choose your city manually instead.';
    case 'GEOLOCATION_UNSUPPORTED':
      return 'This browser cannot provide your current location. Choose your city manually.';
    case 'GEOLOCATION_TIMEOUT':
    case 'GEOLOCATION_UNAVAILABLE':
      return 'Your device location could not be read. Try again or choose your city manually.';
    case 'MAP_PROVIDER_KEY_REJECTED':
    case 'MAP_PROVIDER_NOT_CONFIGURED':
      return 'Current-location lookup is not configured. Choose your city manually.';
    case 'MAP_PROVIDER_TIMEOUT':
    case 'MAP_PROVIDER_UNAVAILABLE':
      return 'Location matching is temporarily unavailable. Choose your city manually.';
    case 'CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET':
      return 'FindIt currently supports Zimbabwe locations. Choose a Zimbabwe city manually.';
    default:
      return 'We could not match your location to a supported city. Choose it manually.';
  }
}
