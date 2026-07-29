import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile('src/components/listings/ListingRecommendations.jsx', 'utf8');
const listingCard = await readFile('src/components/listings/ListingCard.jsx', 'utf8');
const marketplaceCard = await readFile('src/components/marketplace/MarketplaceCard.jsx', 'utf8');
const listingService = await readFile('src/services/publicListingsService.js', 'utf8');
const listingRepository = await readFile('src/repositories/publicListingsRepository.js', 'utf8');

test('Phase 4 recommendation hydration is bounded, ordered and public-only', () => {
  assert.match(component, /MAX_SECTIONS = 6/);
  assert.match(component, /MAX_ITEMS_PER_SECTION = 6/);
  assert.match(component, /MAX_TOTAL_ITEMS = 24/);
  assert.match(listingService, /MAX_RECOMMENDATION_RESULTS = 24/);
  assert.match(listingService, /return ids\.map\(\(id\) => byId\.get\(id\)\)\.filter\(Boolean\)/);
  assert.match(listingRepository, /\.in\('status', \['available', 'under_offer'\]\)/);
  assert.match(listingRepository, /\.abortSignal\(signal\)/);
});

test('Phase 4 sections fail independently and expose complete accessible states', () => {
  assert.match(component, /Promise\.allSettled\(plannedSections\.map/);
  assert.match(component, /response\.status === 'fulfilled'/);
  assert.match(component, /reason: 'transport_unavailable'/);
  assert.match(component, /unavailable: result\.degraded && result\.items\.length === 0/);
  assert.match(component, /RecommendationLoading/);
  assert.match(component, /Suggestions could not be loaded/);
  assert.match(component, /No suggestions are available right now/);
  assert.match(component, /Try again/);
  assert.match(component, /role="alert"/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-labelledby="listing-recommendations-heading"/);
  assert.match(component, /const headingId = useId\(\)/);
  assert.match(component, /grid-cols-2[\s\S]*md:grid-cols-3/);
});

test('Phase 4 analytics record visible impressions and explicit card opens only', () => {
  assert.match(component, /IntersectionObserver/);
  assert.match(component, /recommendation_impression/);
  assert.match(component, /recommendation_click/);
  assert.match(component, /surface: 'listing_detail'/);
  assert.match(component, /recommendationRequestId: section\.requestId/);
  assert.match(listingCard, /onOpen=\{onOpen\}/);
  assert.match(marketplaceCard, /onClick=\{onOpen\}/);
});

test('recommendation failure cannot become a listing-delivery dependency', () => {
  assert.match(component, /queryFn: \(\{ signal \}\)/);
  assert.match(component, /retry: false/);
  assert.match(component, /fetchContextualEcosystemPlan/);
  assert.match(component, /getPublicListingsByIds/);
  assert.doesNotMatch(listingService, /fetchContextualEcosystemPlan|recommendationServices/);
});
