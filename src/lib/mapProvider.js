const MAPLIBRE_VERSION = '5.12.0';
// Served from our own origin rather than a public CDN, so a third party cannot
// execute script on this domain and the Content-Security-Policy needs no
// external script-src entry. Assets are vendored in public/vendor/maplibre and
// are refreshed by scripts/vendor-maplibre-assets.mjs when MAPLIBRE_VERSION
// changes. BASE_URL keeps this correct under a non-root deployment base.
const MAPLIBRE_ASSET_BASE = `${String(import.meta.env?.BASE_URL ?? '/').replace(/\/*$/, '/')}vendor/maplibre/`;
const MAPLIBRE_SCRIPT_URL = `${MAPLIBRE_ASSET_BASE}maplibre-gl.js`;
const MAPLIBRE_STYLESHEET_URL = `${MAPLIBRE_ASSET_BASE}maplibre-gl.css`;
const MAPLIBRE_SCRIPT_ID = 'findit-maplibre-runtime';
const MAPLIBRE_STYLESHEET_ID = 'findit-maplibre-styles';
const MAPTILER_API_ORIGIN = 'https://api.maptiler.com';

let mapLibrePromise = null;

function browserEnv(name) {
  return String(import.meta.env?.[name] ?? '').trim();
}

function ensureMapLibreStylesheet() {
  if (document.getElementById(MAPLIBRE_STYLESHEET_ID)) return;
  const stylesheet = document.createElement('link');
  stylesheet.id = MAPLIBRE_STYLESHEET_ID;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = MAPLIBRE_STYLESHEET_URL;
  document.head.append(stylesheet);
}

function assertMapLibreRuntime(runtime) {
  if (!runtime?.Map || !runtime?.Marker || !runtime?.Popup || !runtime?.LngLatBounds) {
    throw new Error('MAP_RUNTIME_INVALID');
  }
  if (runtime.version && runtime.version !== MAPLIBRE_VERSION) {
    throw new Error('MAP_RUNTIME_VERSION_MISMATCH');
  }
  return runtime;
}

export function mapTilerPublicKey() {
  return browserEnv('VITE_MAPTILER_PUBLIC_KEY');
}

export function mapTilerStyleId() {
  return browserEnv('VITE_MAPTILER_STYLE_ID') || 'streets-v4';
}

export function mapProviderConfigured() {
  return Boolean(mapTilerPublicKey());
}

export function mapTilerStyleUrl() {
  const key = mapTilerPublicKey();
  if (!key) throw new Error('MAP_PROVIDER_NOT_CONFIGURED');
  const styleId = mapTilerStyleId();
  return `${MAPTILER_API_ORIGIN}/maps/${encodeURIComponent(styleId)}/style.json?key=${encodeURIComponent(key)}`;
}

export function loadMapLibre() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('MAP_BROWSER_REQUIRED'));
  }
  if (window.maplibregl) {
    try {
      return Promise.resolve(assertMapLibreRuntime(window.maplibregl));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  if (mapLibrePromise) return mapLibrePromise;

  ensureMapLibreStylesheet();
  mapLibrePromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPLIBRE_SCRIPT_ID);
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('MAP_RUNTIME_TIMEOUT')), 15_000);

    const complete = () => {
      window.clearTimeout(timeout);
      try {
        resolve(assertMapLibreRuntime(window.maplibregl));
      } catch (error) {
        reject(error);
      }
    };
    const fail = () => {
      window.clearTimeout(timeout);
      reject(new Error('MAP_RUNTIME_UNAVAILABLE'));
    };

    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) {
      script.id = MAPLIBRE_SCRIPT_ID;
      script.src = MAPLIBRE_SCRIPT_URL;
      script.async = true;
      document.head.append(script);
    }
  }).catch((error) => {
    mapLibrePromise = null;
    throw error;
  });

  return mapLibrePromise;
}

function boundedCoordinate(value, minimum, maximum, code) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new TypeError(code);
  }
  return numeric;
}

export async function reverseGeocodeMapTiler({ latitude, longitude, signal } = {}) {
  const key = mapTilerPublicKey();
  if (!key) throw new Error('MAP_PROVIDER_NOT_CONFIGURED');
  const lat = boundedCoordinate(latitude, -90, 90, 'INVALID_LATITUDE');
  const lng = boundedCoordinate(longitude, -180, 180, 'INVALID_LONGITUDE');
  const endpoint = new URL(`${MAPTILER_API_ORIGIN}/geocoding/${lng},${lat}.json`);
  endpoint.searchParams.set('key', key);
  endpoint.searchParams.set('language', 'en');
  endpoint.searchParams.set('limit', '1');

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'MAP_PROVIDER_KEY_REJECTED' : 'MAP_PROVIDER_UNAVAILABLE');
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.features)) throw new Error('MAP_PROVIDER_INVALID_RESPONSE');
  return payload.features;
}

export const mapProviderContract = Object.freeze({
  renderer: 'maplibre-gl',
  rendererVersion: MAPLIBRE_VERSION,
  tileProvider: 'maptiler-cloud',
  geocoder: 'maptiler-geocoding',
});
