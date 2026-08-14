import { getNearestMarketplacePlace } from '@/services/locationsService';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

const GEOLOCATION_TIMEOUT_MS = 12_000;
const LOOKUP_TIMEOUT_MS = 12_000;

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

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('LOCATION_LOOKUP_TIMEOUT')), LOOKUP_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function resolveCurrentMarketplaceLocation({ consentGranted = false } = {}) {
  if (!consentGranted) throw new Error('GEOLOCATION_CONSENT_REQUIRED');
  const position = await positionFromBrowser();
  const resolved = await withTimeout(getNearestMarketplacePlace({
    latitude: Number(position.coords.latitude),
    longitude: Number(position.coords.longitude),
  }));
  if (!resolved || String(resolved.country_code || '').toUpperCase() !== LAUNCH_COUNTRY_CODE) {
    throw new Error('CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET');
  }

  return Object.freeze({
    country: resolved.country_id,
    countryName: resolved.country_name,
    countryCode: resolved.country_code,
    state: resolved.province_id,
    stateName: resolved.province_name,
    city: resolved.place_id,
    cityName: resolved.place_name,
    placeType: resolved.place_type,
    source: 'device',
  });
}

export function currentLocationErrorMessage(error) {
  switch (error?.message) {
    case 'GEOLOCATION_CONSENT_REQUIRED':
      return 'Choose Allow once before FindIt asks your browser for location access.';
    case 'GEOLOCATION_PERMISSION_DENIED':
      return 'Location access was declined. You can still choose a Zimbabwe place manually.';
    case 'GEOLOCATION_UNSUPPORTED':
      return 'This browser cannot provide your current location. Choose a place manually.';
    case 'GEOLOCATION_TIMEOUT':
    case 'GEOLOCATION_UNAVAILABLE':
      return 'Your device location could not be read. Try again or choose a place manually.';
    case 'LOCATION_LOOKUP_TIMEOUT':
      return 'Location matching took too long. Try again or choose a place manually.';
    case 'CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET':
      return 'That position is outside the Zimbabwe marketplace. Choose a Zimbabwe place manually.';
    default:
      return 'We could not match your position to a registered place. Choose it manually instead.';
  }
}
