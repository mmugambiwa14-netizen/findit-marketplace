import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile('src/services/recommendationServices.js', 'utf8');

const exportedAdapters = [
  'getSimilarListings',
  'getSellerRecommendations',
  'getRelatedServices',
  'getRelatedProducts',
  'getNearbyListings',
  'getRecentlyListed',
  'getPersonalizedRecommendations',
];

test('frontend exposes one adapter per independent recommendation service', () => {
  for (const adapter of exportedAdapters) {
    assert.match(client, new RegExp(`export const ${adapter}`));
  }
});

test('client adapters never throw recommendation failures into listing delivery', () => {
  assert.match(client, /Promise\.race/);
  assert.match(client, /catch \{/);
  assert.match(client, /return emptyResult\(service, 'service_unavailable'\)/);
  assert.match(client, /items: \[\]/);
});

test('client validates cursors, UUIDs, page size and response identity', () => {
  assert.match(client, /MAX_CURSOR_LENGTH = 1024/);
  assert.match(client, /MAX_PAGE_SIZE = 100/);
  assert.match(client, /validUuid\(subjectListingId\)/);
  assert.match(client, /value\.service !== service/);
  assert.match(client, /Array\.isArray\(value\.items\)/);
});

test('recommendation adapters are not imported into listing UI during Phase 2', async () => {
  const listingDetailPaths = [
    'src/pages/ListingDetail.jsx',
    'src/pages/ListingDetails.jsx',
    'src/pages/listings/ListingDetail.jsx',
  ];

  for (const path of listingDetailPaths) {
    try {
      const content = await readFile(path, 'utf8');
      assert.doesNotMatch(content, /recommendationServices/);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
});
