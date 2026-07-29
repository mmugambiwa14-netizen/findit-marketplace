import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const independentPaths = [
  '../src/App.jsx',
  '../src/services/publicListingsService.js',
];
const detailPaths = [
  '../src/pages/PropertyDetail.jsx',
  '../src/pages/CarDetail.jsx',
  '../src/pages/MachineryDetail.jsx',
];

const independentFiles = await Promise.all(independentPaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
const detailFiles = await Promise.all(detailPaths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

test('listing routes and listing delivery do not import recommendation infrastructure', () => {
  for (const [index, source] of independentFiles.entries()) {
    assert.doesNotMatch(
      source,
      /recommendationEventsService|recommendationService|recommendation-maintenance|recommendation_cache|listing_recommendation_features/,
      `${independentPaths[index]} must remain independent from recommendation infrastructure`,
    );
  }
});

test('all public listing detail pages load the listing through the established service first', () => {
  for (const source of detailFiles) {
    assert.match(source, /getPublicListing/);
    assert.match(source, /if \(isLoading\) return <DetailLoading/);
    assert.match(source, /if \(error\) return <DetailError/);
    assert.match(source, /if \(!(?:property|car|item)\) return <DetailMissing/);
    assert.match(source, /<ListingRecommendations subjectListingId=/);
    assert.doesNotMatch(source, /from ["']@\/services\/recommendation/);
  }
});

test('the application route graph has no recommendation provider at boot', () => {
  assert.doesNotMatch(independentFiles[0], /RecommendationProvider|recommendationEventsService/);
  assert.match(independentFiles[0], /const PropertyDetail = lazy/);
  assert.match(independentFiles[0], /const CarDetail = lazy/);
  assert.match(independentFiles[0], /const MachineryDetail = lazy/);
});
