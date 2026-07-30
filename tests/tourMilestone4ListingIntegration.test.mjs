import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const marketplaceCard = await readFile(new URL('../src/components/marketplace/MarketplaceCard.jsx', import.meta.url), 'utf8');
const listingCard = await readFile(new URL('../src/components/listings/ListingCard.jsx', import.meta.url), 'utf8');
const mediaViewer = await readFile(new URL('../src/components/listings/ListingMediaViewer.jsx', import.meta.url), 'utf8');
const serviceCard = await readFile(new URL('../src/components/services/ServiceCard.jsx', import.meta.url), 'utf8');
const tourService = await readFile(new URL('../src/services/listingToursService.js', import.meta.url), 'utf8');
const publicListings = await readFile(new URL('../src/services/publicListingsService.js', import.meta.url), 'utf8');
const services = await readFile(new URL('../src/services/servicesService.js', import.meta.url), 'utf8');
const savedRepository = await readFile(new URL('../src/repositories/favouritesRepository.js', import.meta.url), 'utf8');

const detailFiles = [
  '../src/pages/PropertyDetail.jsx',
  '../src/pages/CarDetail.jsx',
  '../src/pages/MachineryDetail.jsx',
  '../src/pages/ServiceDetail.jsx',
];
const details = await Promise.all(detailFiles.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

test('listing cards retain canonical image media and attach lightweight Peek summaries', () => {
  assert.match(marketplaceCard, /tour=\{tourSummary\(listing\)\}/);
  assert.match(listingCard, /MarketplaceCard/);
  assert.match(tourService, /attachPublicTourSummaries/);
  assert.match(tourService, /tryGetPublicTourPlayback/);
  assert.match(tourService, /metadata outage must degrade to the canonical image-only listing/i);
  assert.match(publicListings, /attachPublicTourSummaries/);
  assert.doesNotMatch(publicListings, /tryGetPublicTourPlayback/);
  assert.match(services, /attachPublicTourSummaries/);
  assert.doesNotMatch(services, /tryGetPublicTourPlayback/);
  assert.match(mediaViewer, /getPublicTourPlayback/);
  assert.match(mediaViewer, /onClick=\{openTour\}/);
});

test('cards and details use one canonical identity with explicit Peek deep links', () => {
  assert.match(marketplaceCard, /const tourTarget =/);
  assert.match(marketplaceCard, /media=tour/);
  assert.match(marketplaceCard, /\{tourLabel\}\{tourDuration \? ` · \$\{tourDuration\}`/);
  assert.match(listingCard, /tour=\{tourSummary\(listing\)\}/);
  assert.match(serviceCard, /tourLabel="Peek"/);
  assert.match(mediaViewer, /requestedTour && "ring-2/);
  assert.match(mediaViewer, /requestedTour \? "Play Peek" : tourActionLabel/);
  assert.match(mediaViewer, /onError=\{onPlaybackError\}/);
  assert.match(mediaViewer, /playback link expired or the video could not be loaded/);
  assert.match(mediaViewer, /onClick=\{showPhotos\}/);
  assert.match(mediaViewer, />\s*Photos\s*</);
  assert.match(mediaViewer, /mode === "photos"/);
  assert.match(mediaViewer, /\{hasTour &&/);
  assert.match(mediaViewer, /tourActionLabel/);
  const publicRepository = savedRepository;
  assert.match(publicRepository, /favourites/);
  for (const detail of details) {
    assert.match(detail, /ListingMediaViewer/);
    assert.match(detail, /tour=\{item\.tour \|\| null\}/);
    assert.match(detail, /tourActionLabel="Take a Peek"/);
  }
});
