import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeTourFeedRequest, normalizeTourFeedResponse } from '../src/services/listingTourContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  feedFunction,
  tourRuntime,
  repository,
  service,
  contracts,
  queryKeys,
  page,
  card,
  header,
  chips,
  app,
  invalidation,
  config,
  packageJson,
  smoke,
] = await Promise.all([
  read('supabase/migrations/0038_v1_public_tours_catalogue.sql'),
  read('supabase/rollback/0038_v1_public_tours_catalogue.rollback.sql'),
  read('supabase/functions/tour-feed/index.ts'),
  read('supabase/functions/_shared/tour-runtime.ts'),
  read('src/repositories/listingToursRepository.js'),
  read('src/services/listingToursService.js'),
  read('src/services/listingTourContracts.js'),
  read('src/services/listingTourQueryKeys.js'),
  read('src/pages/Tours.jsx'),
  read('src/components/tours/TourCard.jsx'),
  read('src/components/tours/TourCatalogueHeader.jsx'),
  read('src/components/tours/TourCategoryChips.jsx'),
  read('src/App.jsx'),
  read('src/lib/canonicalQueryInvalidation.js'),
  read('supabase/config.toml'),
  read('package.json'),
  read('scripts/tours-public-catalogue-smoke-local.mjs'),
]);

test('public Tours feed is a bounded service-only keyset read model', () => {
  assert.match(migration, /create or replace function public\.public_tour_feed/);
  assert.match(migration, /p_cursor_published_at timestamptz/);
  assert.match(migration, /p_cursor_id uuid/);
  assert.match(migration, /\(row_published_at, row_tour_id\) < \(p_cursor_published_at, p_cursor_id\)/);
  assert.match(migration, /order by row_published_at desc, row_tour_id desc/);
  assert.match(migration, /limit p_limit \+ 1/);
  assert.doesNotMatch(migration, /offset\s+p_/i);
  assert.match(migration, /grant execute on function public\.public_tour_feed[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.public_tour_feed[\s\S]*to anon|to authenticated/);
});

test('feed read model preserves canonical listing identity across all four catalogue categories', () => {
  for (const value of ['property', 'car', 'machinery', 'service']) assert.match(migration, new RegExp(`'${value}'`));
  for (const field of [
    'tour_id uuid', 'parent_type text', 'parent_id uuid', 'listing_type text',
    'title text', 'price numeric', 'currency text', 'public_location text',
    'duration_seconds numeric', 'availability text', 'summary_attributes jsonb',
    'seller_id uuid', 'seller_display_name text', 'seller_type text', 'published_at timestamptz',
  ]) assert.match(migration, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(migration, /l\.status in \('available', 'under_offer'\)/);
  assert.match(migration, /service\.status = 'active'/);
  assert.match(migration, /service\.category <> 'legal'/);
  assert.match(migration, /public\.is_tour_public_eligible\(t\.id\)/);
});

test('feed signing boundary exposes only signed card assets and withholds playback until explicit interaction', () => {
  assert.match(feedFunction, /admin\.rpc\("public_tour_feed"/);
  assert.match(feedFunction, /signByBucket\(admin, "tour-thumbnails"/);
  assert.match(feedFunction, /signByBucket\(admin, "listing-images"/);
  assert.match(feedFunction, /signByBucket\(admin, "marketplace-images"/);
  assert.match(feedFunction, /signedCardAssetLifetimeSeconds/);
  assert.match(feedFunction, /nextCursor/);
  assert.match(tourRuntime, /signedPlaybackLifetimeSeconds: 300/);
  assert.match(tourRuntime, /signedCardAssetLifetimeSeconds: 3600/);
  assert.match(feedFunction, /TOUR_LIMITS\.signedCardAssetLifetimeSeconds/);
  assert.doesNotMatch(feedFunction, /playback_storage_path|source_storage_path|playbackUrl/);
  assert.match(config, /\[functions\.tour-feed\][\s\S]*verify_jwt = false/);
  assert.match(repository, /supabase\.functions\.invoke\('tour-feed'/);
  assert.match(service, /getPublicTourFeedPage/);
  assert.match(service, /publicTourDetailPath/);
  assert.match(contracts, /normalizeTourFeedRequest/);
  assert.match(contracts, /normalizeTourFeedResponse/);
});

test('catalogue UI is cinematic but not a social-video feed', () => {
  assert.match(page, /useInfiniteQuery/);
  assert.match(page, /getNextPageParam/);
  assert.match(page, /Load more Peeks/);
  assert.match(page, /TourCategoryChips/);
  assert.match(header, /Search listings, sellers or locations/);
  for (const label of ['All', 'Property', 'Vehicles', 'Equipment', 'Services']) assert.match(chips, new RegExp(label));
  assert.match(card, /aspect-video/);
  assert.match(card, /View listing/);
  assert.match(card, /Save/);
  assert.match(card, /Share/);
  assert.match(card, /Chat/);
  assert.doesNotMatch(`${page}\n${card}`, /public likes|comments|followers|trending|reaction|creator feed/i);
  assert.doesNotMatch(card, /loop|playsInline[\s\S]*autoPlay[\s\S]*unmuted/i);
});

test('playback is thumbnail-first, explicit, low-data aware and resilient', () => {
  assert.match(card, /onClick=\{loadPlayback\}/);
  assert.match(card, /getPublicTourPlayback/);
  assert.match(card, /poster=\{item\.thumbnailUrl/);
  assert.match(card, /navigator\['connection'\]\?\.saveData/);
  assert.match(card, /preload=.*'none'.*'metadata'/);
  assert.match(card, /muted/);
  assert.match(card, /onError=\{\(\) => \{ setPlayback\(null\); setPlaybackError\(true\); \}\}/);
  assert.match(card, /expiresAt > Date\.now\(\) \+ 10_000/);
  assert.match(card, /Peek playback failed/);
  assert.match(card, /writeStoredString\('session', playbackKey/);
  assert.match(card, /readStoredString\('session', playbackKey/);
});

test('feed filters and return position survive canonical navigation', () => {
  assert.match(page, /useSearchParams/);
  assert.match(page, /findit:peek:catalogue-state/);
  assert.match(page, /scrollY: window\.scrollY/);
  assert.match(page, /window\.scrollTo/);
  assert.match(page, /activeTourId/);
  assert.match(page, /pageCount: Math\.max\(1, loadedPageCount\)/);
  assert.match(page, /filters: \{ q: deferredQuery, location: deferredLocation, category \}/);
  assert.match(page, /new URLSearchParams\(paramsKey\)/);
  assert.match(page, /fetchNextPage\(\)/);
  assert.match(queryKeys, /publicFeed/);
  assert.match(invalidation, /\['listing-tours', 'feed'\]/);
});

test('production route uses the real Peek catalogue only when Tours is enabled', () => {
  assert.match(app, /const Tours = lazy/);
  assert.match(app, /featureFlags\.tours && <Route path="\/peek" element=\{<Tours \/>\}/);
  assert.match(app, /path="\/tours" element=\{<LegacyPathRedirect to="\/peek" \/>\}/);
  assert.match(app, /!featureFlags\.tours && featureFlags\.toursPreview/);
  assert.match(packageJson, /test:tours-discovery-local/);
  assert.match(packageJson, /tours-public-catalogue-smoke-local\.mjs/);
});

test('rollback and smoke cover cursor integrity, category filtering and unavailable exclusion', () => {
  assert.match(rollback, /drop function if exists public\.public_tour_feed/);
  assert.match(rollback, /drop index if exists public\.idx_listing_tour_slots_current/);
  assert.match(rollback, /drop index if exists public\.idx_services_location_name_trgm/);
  assert.match(migration, /row_title ilike/);
  assert.match(migration, /escape E'\\\\'/);
  assert.match(smoke, /no duplicate Tours across cursor pages/);
  assert.match(smoke, /service category filter/);
  assert.match(smoke, /unavailable listing leaves public Tours catalogue/);
  assert.match(smoke, /feed does not expose playback URLs/);
});


test('feed contracts reject unsafe asset URLs and invalid prices', () => {
  assert.match(contracts, /function boundedHttpUrl/);
  assert.match(contracts, /parsed\.protocol === 'https:' \|\| parsed\.protocol === 'http:'/);
  assert.match(contracts, /Tour feed price is invalid/);
  assert.match(card, /disabled=\{saving\}/);
});


test('executable feed contracts normalize safe rows and reject poisoned fields', () => {
  const base = {
    tourId: '11111111-1111-4111-8111-111111111111',
    parentType: 'listing',
    parentId: '22222222-2222-4222-8222-222222222222',
    listingType: 'car',
    title: 'Verified vehicle',
    price: 12500,
    currency: 'USD',
    pricingType: null,
    publicLocation: 'Harare',
    coverImageUrl: 'https://example.com/cover.webp',
    thumbnailUrl: 'https://example.com/thumb.webp',
    durationSeconds: 48,
    availability: 'available',
    summaryAttributes: ['2024', '10,000 km'],
    sellerId: '33333333-3333-4333-8333-333333333333',
    sellerDisplayName: 'Seller',
    sellerType: 'seller',
    publishedAt: '2026-07-27T10:00:00.000Z',
  };
  const normalized = normalizeTourFeedResponse({
    items: [{ ...base, thumbnailUrl: 'javascript:alert(1)' }],
    nextCursor: { publishedAt: base.publishedAt, id: base.tourId },
    signedAssetLifetimeSeconds: 3600,
  });
  assert.equal(normalized.items[0].thumbnailUrl, null);
  assert.equal(normalized.items[0].coverImageUrl, base.coverImageUrl);
  assert.equal(normalized.signedAssetLifetimeSeconds, 3600);
  assert.throws(() => normalizeTourFeedResponse({ items: [{ ...base, price: -1 }] }), /price is invalid/);
  assert.throws(() => normalizeTourFeedResponse({ items: [{ ...base, durationSeconds: 121 }] }), /duration is invalid/);
});

test('executable feed request contract bounds pages and cursor shape', () => {
  assert.deepEqual(normalizeTourFeedRequest({ category: 'CAR', limit: 8 }), {
    category: 'car', query: '', location: '', limit: 8, cursor: null,
  });
  assert.throws(() => normalizeTourFeedRequest({ category: 'people' }), /category is invalid/);
  assert.throws(() => normalizeTourFeedRequest({ limit: 25 }), /between 1 and 24/);
  assert.throws(() => normalizeTourFeedRequest({ cursor: { id: 'bad', publishedAt: 'nope' } }), /cursor is invalid/);
});
