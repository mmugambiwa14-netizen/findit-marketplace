import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  listingMedia,
  listingEnrichment,
  publicListings,
  sellerProfiles,
  favourites,
  marketplaceMedia,
  serviceEnrichment,
  services,
  businessProfiles,
  listingCard,
] = await Promise.all([
  read('src/services/listingCreationService.js'),
  read('src/services/listingCardEnrichmentService.js'),
  read('src/services/publicListingsService.js'),
  read('src/services/sellerProfilesService.js'),
  read('src/services/favouritesService.js'),
  read('src/services/marketplaceImagesService.js'),
  read('src/services/serviceCardEnrichmentService.js'),
  read('src/services/servicesService.js'),
  read('src/services/businessProfilesService.js'),
  read('src/components/listings/ListingCard.jsx'),
]);

test('listing cards sign only one displayable cover per row in one batch', () => {
  assert.match(listingMedia, /export async function hydrateListingCardImages/);
  assert.match(listingMedia, /const coverValues = listings\.map\(firstDisplayablePhoto\)/);
  assert.match(listingMedia, /const storagePaths = \[\.\.\.new Set\(coverValues\.filter\(isTrustedListingImagePath\)\)\]/);
  assert.match(listingMedia, /signListingImagePaths\(storagePaths\)/);
  assert.match(listingMedia, /photos: resolvedCover \? \[resolvedCover\] : \[\]/);
  assert.match(listingCard, /imageUrl=\{listing\.photos\?\.\[0\]\}/);
});

test('full listing galleries remain on the detail boundary', () => {
  assert.match(publicListings, /const \[hydrated\] = await hydrateListingImages\(\[row\]\)/);
  assert.match(listingMedia, /export async function hydrateListingImages/);
  assert.match(listingMedia, /listings\.flatMap/);
});

test('public listing card media and Peek summaries load in parallel', () => {
  assert.match(listingEnrichment, /await Promise\.all\(\[/);
  assert.match(listingEnrichment, /hydrateListingCardImages\(source\)/);
  assert.match(listingEnrichment, /attachPublicTourSummaries\(baseListings, 'listing'\)/);
  assert.match(publicListings, /return enrichPublicListingCards\(rows\)/);
  assert.match(publicListings, /const items = await enrichPublicListingCards\(cleanRows\)/);
  assert.match(publicListings, /const items = await enrichPublicListingCards\(cleanRows\);\s+throwIfAborted\(signal\);\s+return \{\s+items,/);
});

test('all public listing inventory card surfaces use the shared cover-only enrichment boundary', () => {
  assert.match(sellerProfiles, /enrichPublicListingCards\(page\.items\)/);
  assert.match(favourites, /enrichPublicListingCards\(await findSavedListingsByIds\(listingIds\)\)/);
  assert.match(businessProfiles, /enrichPublicListingCards\(page\.items\)/);
  assert.doesNotMatch(sellerProfiles, /hydrateListingImages/);
  assert.doesNotMatch(favourites, /hydrateListingImages/);
  assert.doesNotMatch(businessProfiles, /hydrateListingImages/);
});

test('service cards batch one cover per row instead of signing one gallery per service', () => {
  assert.match(marketplaceMedia, /export async function hydrateMarketplaceCardImages/);
  assert.match(marketplaceMedia, /const covers = values\.map/);
  assert.match(marketplaceMedia, /signMarketplaceImagePaths\(storagePaths\)/);
  assert.match(marketplaceMedia, /photos: resolvedCover \? \[resolvedCover\] : \[\]/);
  assert.match(serviceEnrichment, /hydrateMarketplaceCardImages\(source, 'service_photo'\)/);
  assert.match(serviceEnrichment, /await Promise\.all\(\[/);
  assert.match(serviceEnrichment, /attachPublicTourSummaries\(base, 'service'\)/);
});

test('public service browse and business service inventory use the batched service-card boundary', () => {
  assert.match(services, /items: await enrichPublicServiceCards\(page\.items\)/);
  assert.match(services, /enrichPublicServiceCards\(rows, \{ includeTours: false \}\)/);
  assert.match(businessProfiles, /items: await enrichPublicServiceCards\(page\.items\)/);
});
