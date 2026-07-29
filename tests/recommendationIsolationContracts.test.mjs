import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = [
  '../src/App.jsx',
  '../src/pages/PropertyDetail.jsx',
  '../src/pages/CarDetail.jsx',
  '../src/pages/MachineryDetail.jsx',
  '../src/services/publicListingsService.js',
];

const files = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

test('listing routes and listing delivery do not import recommendation infrastructure', () => {
  for (const [index, source] of files.entries()) {
    assert.doesNotMatch(
      source,
      /recommendationEventsService|recommendationService|recommendation-maintenance|recommendation_cache|listing_recommendation_features/,
      `${paths[index]} must remain independent from recommendation infrastructure`,
    );
  }
});

test('all public listing detail pages load the listing through the established service first', () => {
  for (const source of files.slice(1, 4)) {
    assert.match(source, /getPublicListing/);
    assert.match(source, /if \(isLoading\) return <DetailLoading/);
    assert.match(source, /if \(error\) return <DetailError/);
  }
});

test('the application route graph has no recommendation provider at boot', () => {
  assert.doesNotMatch(files[0], /RecommendationProvider|recommendationEventsService/);
  assert.match(files[0], /const PropertyDetail = lazy/);
  assert.match(files[0], /const CarDetail = lazy/);
  assert.match(files[0], /const MachineryDetail = lazy/);
});
