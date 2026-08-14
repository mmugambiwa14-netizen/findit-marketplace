import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('home Peek rail has a real marketplace fallback for feed outages', async () => {
  const rail = await read('src/components/discover/HomePeekRail.jsx');
  const service = await read('src/services/publicListingsService.js');
  const repository = await read('src/repositories/publicListingsRepository.js');

  assert.match(rail, /getPublicHomeListings/);
  assert.match(rail, /enabled: featureFlags\.tours && feed\.isError/);
  assert.match(rail, /Peeks are temporarily unavailable/);
  assert.match(rail, /<ListingCard/);
  assert.match(service, /findLatestAvailableMarketplaceListings/);
  assert.match(service, /locationMatched/);
  assert.match(repository, /findLatestAvailableMarketplaceListings/);
  assert.match(repository, /\.in\('status', \['available', 'under_offer'\]\)/);
});

test('home Peek fallback remains on the canonical public listing boundary', async () => {
  const rail = await read('src/components/discover/HomePeekRail.jsx');
  assert.doesNotMatch(rail, /supabase/);
  assert.doesNotMatch(rail, /previewFixtures|localPreviewListings/);
});
