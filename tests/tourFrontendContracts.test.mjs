import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [service, repository, keys] = await Promise.all([
  readFile(new URL('../src/services/listingToursService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/repositories/listingToursRepository.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/services/listingTourQueryKeys.js', import.meta.url), 'utf8'),
]);

test('dormant frontend service refuses Tour actions while the UI flag is disabled', () => {
  assert.match(service, /if \(!featureFlags\.tours\) throw new Error\('Tours are not enabled in this build'\)/);
  assert.match(service, /uploadListingTour/);
  assert.match(service, /getPublicTourPlayback/);
  assert.match(service, /removeListingTour/);
  assert.match(service, /retryListingTour/);
});

test('frontend upload sequence uses intent, signed direct upload and completion', () => {
  const uploadFunction = service.slice(service.indexOf('export async function uploadListingTour'));
  assert.match(uploadFunction, /invokeTourUploadIntent/);
  assert.match(uploadFunction, /uploadTourSourceObject/);
  assert.match(uploadFunction, /invokeTourUploadComplete/);
  assert.match(repository, /uploadToSignedUrl/);
});

test('Tour query keys stay parent- and account-scoped rather than creating a second marketplace identity', () => {
  assert.match(keys, /ownerParent: \(parentType, parentId, userId = null\)/);
  assert.match(keys, /publicParent: \(parentType, parentId\)/);
  assert.doesNotMatch(keys, /creator|followers|likes|reels/i);
});
