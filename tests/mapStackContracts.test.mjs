import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [provider, mapComponent, locationService, locationSelector, homePage, packageSource] = await Promise.all([
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/search/SearchResultsMap.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/currentLocationService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/location/LocationSelector.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8'),
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

test('device location resolves and stores only a supported public city', () => {
  assert.match(locationService, /getActiveLocations\('country'\)/);
  assert.match(locationService, /getActiveLocations\('province'\)/);
  assert.match(locationService, /getActiveLocations\('city'\)/);
  assert.match(locationService, /reverseGeocodeMapTiler/);
  assert.match(locationService, /CURRENT_LOCATION_OUTSIDE_SUPPORTED_MARKET/);
  assert.match(locationService, /return Object\.freeze\(\{[\s\S]*country:[\s\S]*state:[\s\S]*city:[\s\S]*cityName:[\s\S]*source: 'device'/);
  assert.doesNotMatch(locationService, /return \{[\s\S]{0,220}coordinates,/);
  assert.doesNotMatch(locationService, /accuracyMeters/);
  assert.doesNotMatch(locationService, /localStorage|sessionStorage|insert|update|upsert/i);
  assert.match(locationSelector, /sent to MapTiler/);
  assert.match(locationSelector, /stores only the matched country, province and city/);
  assert.match(locationSelector, /not your exact coordinates/);
  assert.match(locationSelector, /Choose your city manually/);
  assert.match(homePage, /function publicLocation\(value\)/);
  assert.match(homePage, /country:[\s\S]*state:[\s\S]*city:[\s\S]*cityName:[\s\S]*source:/);
  assert.match(homePage, /writeStoredJson\('local', LOCATION_STORAGE_KEY, safeLocation\)/);
  assert.doesNotMatch(homePage, /latitude|longitude|coordinates|accuracyMeters/);
});

test('legacy Leaflet packages and source imports are removed', () => {
  assert.equal(packageJson.dependencies.leaflet, undefined);
  assert.equal(packageJson.devDependencies['@types/leaflet'], undefined);
  assert.doesNotMatch(mapComponent, /from ['"]leaflet['"]/);
  assert.doesNotMatch(mapComponent, /leaflet\.css/);
});
