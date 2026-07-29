import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile('supabase/migrations/0059_independent_recommendation_services.sql', 'utf8');
const isolation = await readFile('supabase/migrations/0060_recommendation_global_service_isolation.sql', 'utf8');
const cacheHardening = await readFile('supabase/migrations/0061_recommendation_service_runtime_policy_and_cache.sql', 'utf8');
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
    assert.match(entry, new RegExp(`serveRecommendationService\\("${service}"\\)`));
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

test('runtime degrades safely and isolates repeated service failures', () => {
  assert.match(runtime, /Promise\.race/);
  assert.match(runtime, /reason, "timeout"/);
  assert.match(runtime, /"service_unavailable"/);
  assert.match(runtime, /FAILURE_THRESHOLD = 3/);
  assert.match(runtime, /CIRCUIT_OPEN_MS = 30_000/);
  assert.match(runtime, /reason, "circuit_open"/);
  assert.match(runtime, /items: \[\]/);
});

test('runtime obeys database policy instead of hard-coded timeout and cache limits', () => {
  assert.match(cacheHardening, /get_recommendation_service_policy_v1/);
  assert.match(runtime, /runtimePolicy\(adminClient, service\)/);
  assert.match(runtime, /policy\.timeoutMs/);
  assert.match(runtime, /policy\.maximumPageSize/);
  assert.match(runtime, /policy\.cacheFreshSeconds/);
  assert.match(runtime, /policy\.cacheStaleSeconds/);
  assert.doesNotMatch(runtime, /executeWithTimeout\([^\n]+, 1200\)/);
});

test('public services use stale cache fallback but personalization never enters shared cache', () => {
  assert.match(runtime, /sharedCacheAllowed: false/);
  assert.match(runtime, /recommendation_cache/);
  assert.match(runtime, /cache: "fresh"/);
  assert.match(runtime, /stale: true/);
  assert.match(cacheHardening, /fail_open_cache_invalidation/);
  assert.match(cacheHardening, /personalized_shared_cache', false/);
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

test('runtime validates database payload identity before returning or caching it', () => {
  assert.match(runtime, /value\.service === service/);
  assert.match(runtime, /Number\(value\.contractVersion\) === contractVersion/);
  assert.match(runtime, /Array\.isArray\(value\.items\)/);
  assert.match(runtime, /invalid_or_unavailable_response/);
});
