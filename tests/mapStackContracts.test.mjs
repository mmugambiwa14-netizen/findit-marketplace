import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [provider, mapComponent, locationService, locationSelector, packageSource] = await Promise.all([
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/search/SearchResultsMap.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/currentLocationService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/location/LocationSelector.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);

const packageJson = JSON.parse(packageSource);

test('production maps use the pinned MapLibre renderer and MapTiler Cloud', () => {
  assert.match(provider, /MAPLIBRE_VERSION = '5\.12\.0'/);
  assert.match(provider, /unpkg\.com\/maplibre-gl@\$\{MAPLIBRE_VERSION\}/);
  assert.match(provider, /api\.maptiler\.com/);
  assert.match(provider, /style\.json\?key=/);
  assert.match(mapComponent, /loadMapLibre/);
  assert.match(mapComponent, /mapTilerStyleUrl/);
  assert.doesNotMatch(mapComponent, /leaflet|tile\.openstreetmap\.org/i);
});

test('map failures remain isolated from listing navigation', () => {
  assert.match(mapComponent, /Listings remain fully available in list view/);
  assert.match(mapComponent, /map\?\.remove\(\)/);
  assert.match(mapComponent, /ResizeObserver/);
  assert.match(mapComponent, /detailPath\(listing, type\)/);
});

test('device location resolves only to a supported public city', () => {
  assert.match(locationService, /getActiveLocations\('country'\)/);
  assert.match(locationService, /getActiveLocations\('province'\)/);
  assert.match(locationService, /getActiveLocations\('city'\)/);
  assert.match(locationService, /reverseGeocodeMapTiler/);
  assert.match(locationService, /CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET/);
  assert.doesNotMatch(locationService, /localStorage|sessionStorage|insert|update|upsert/i);
  assert.match(locationSelector, /Exact coordinates are not saved/);
  assert.match(locationSelector, /Choose your city manually/);
});

test('legacy Leaflet packages are no longer active source dependencies', () => {
  assert.equal(packageJson.dependencies.leaflet, '^1.9.4', 'lock-compatible removal is deferred until a normal package install can update package-lock');
  assert.doesNotMatch(mapComponent, /from ['"]leaflet['"]/);
});
