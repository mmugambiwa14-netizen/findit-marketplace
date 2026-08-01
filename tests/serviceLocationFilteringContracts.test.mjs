import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [repository, page, map] = await Promise.all([
  readFile(new URL('../src/repositories/servicesRepository.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Services.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/discover/DiscoverMapView.jsx', import.meta.url), 'utf8'),
]);

test('service discovery applies the selected marketplace place end to end', () => {
  assert.match(repository, /if \(request\.locationId\) query = query\.eq\('location_id', request\.locationId\)/);
  assert.match(page, /getPublicServicesPage\(\{ category, query, locationId,/);
  assert.match(page, /Near \{locationName \|\| 'selected location'\}/);
  assert.match(map, /getPublicServicesPage\(\{ locationId, limit: 24 \}\)/);
});
