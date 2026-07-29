import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile('supabase/migrations/0059_independent_recommendation_services.sql', 'utf8');
const isolation = await readFile('supabase/migrations/0060_recommendation_global_service_isolation.sql', 'utf8');
const runtime = await readFile('supabase/functions/_shared/recommendation-service.ts', 'utf8');

const services = [
  ['similar-listings', 'similar_listings_service'],
  ['seller-recommendations', 'seller_recommendations_service'],
  ['related-services', 'related_services_service'],
  ['related-products', 'related_products_service'],
  ['nearby-listings', 'nearby_service'],
  ['recently-listed', 'recently_listed_service'],
  ['personalized-recommendations', 'personalized_recommendation_service'],
];

test('Phase 2 exposes seven independently deployable service entry points', async () => {
  for (const [directory, service] of services) {
    const entry = await readFile(`supabase/functions/${directory}/index.ts`, 'utf8');
    assert.match(entry, new RegExp(`serveRecommendationService\\(\"${service}\"\\)`));
    assert.match(migration, new RegExp(service));
  }
});

test('service contracts are cursor-only, versioned and reason-code based', () => {
  assert.match(migration, /contract_version integer not null default 1/);
  assert.match(migration, /decode_recommendation_cursor_v1/);
  assert.match(migration, /encode_recommendation_cursor_v1/);
  assert.doesNotMatch(migration, /\boffset\b/i);
  assert.match(migration, /reasonCode/);
  assert.doesNotMatch(migration, /promotional|generated copy/i);
});

test('runtime degrades to an empty successful response instead of failing listing delivery', () => {
  assert.match(runtime, /Promise\.race/);
  assert.match(runtime, /reason: \"timeout\"/);
  assert.match(runtime, /reason: \"service_unavailable\"/);
  assert.match(runtime, /items: \[\]/);
  assert.match(runtime, /status, 200|json\(request, 200/);
});

test('personalization requires an authenticated user and direct dispatcher access is removed', () => {
  assert.match(runtime, /authenticationRequired: true/);
  assert.match(runtime, /auth\.getUser\(\)/);
  assert.match(isolation, /revoke execute on function public\.recommendation_service_v1[\s\S]*from service_role/);
});

test('HTTP boundaries enforce payload, origin, cursor and page-size limits', () => {
  assert.match(runtime, /contentLength > 4096/);
  assert.match(runtime, /origin_not_allowed/);
  assert.match(runtime, /body\.cursor\.length > 1024/);
  assert.match(runtime, /boundedInteger\(body\.limit, 12, 1, 100\)/);
});
