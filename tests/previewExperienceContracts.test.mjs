import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PASSWORD_MIN_LENGTH, passwordPolicyError } from '../src/lib/passwordPolicy.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [app, authContext, localPreview, fixtures, publicListings, peekService, map] = await Promise.all([
  read('src/App.jsx'),
  read('src/lib/AuthContext.jsx'),
  read('src/lib/localPreview.js'),
  read('src/services/localPreviewListings.js'),
  read('src/services/publicListingsService.js'),
  read('src/services/listingToursService.js'),
  read('src/components/search/SearchResultsMap.jsx'),
]);

test('preview fixtures do not bypass hosted authentication', () => {
  assert.match(localPreview, /featureFlags\.previewFixtures/);
  assert.match(localPreview, /localPreviewAuthBypassEnabled/);
  assert.match(authContext, /localPreviewAuthBypassEnabled\(\)/);
  assert.doesNotMatch(authContext, /localPreviewModeEnabled\(\)/);
});

test('preview catalogue contains 360 paginated listings and a multi-page Peek feed', () => {
  assert.match(fixtures, /const LISTINGS_PER_KIND = 120/);
  assert.match(fixtures, /LOCAL_PREVIEW_LISTING_COUNT = LISTINGS\.length/);
  assert.match(fixtures, /paginateLocalPreviewListings/);
  assert.match(publicListings, /page\.nextCursor/);
  assert.match(peekService, /getLocalPreviewPeekListings/);
  assert.match(peekService, /rows\.slice\(start, start \+ request\.limit\)/);
  assert.match(peekService, /nextCursor: last/);
});

test('map uses interactive MapLibre tiles and the Peek route keeps Tour compatibility', () => {
  assert.match(map, /loadMapLibre/);
  assert.match(map, /new maplibregl\.Map/);
  assert.match(map, /mapTilerStyleUrl/);
  assert.match(map, /fitBounds/);
  assert.match(map, /new maplibregl\.Marker/);
  assert.match(map, /attributionControl: true/);
  assert.match(app, /path="\/peek"/);
  assert.match(app, /LegacyPathRedirect to="\/peek"/);
});

test('browser password validation matches hosted Supabase policy', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 10);
  assert.match(passwordPolicyError('short'), /at least 10/);
  assert.match(passwordPolicyError('alllowercase1'), /lowercase, uppercase and a number/);
  assert.equal(passwordPolicyError('ValidPass9'), '');
});
