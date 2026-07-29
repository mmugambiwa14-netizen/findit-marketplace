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
  assert.match(runtime, /"timeout"/);
  assert.match(runtime, /"service_unavailable"/);
  assert.match(runtime, /FAILURE_THRESHOLD = 3/);
  assert.match(runtime, /CIRCUIT_OPEN_MS = 30_000/);
  assert.match(runtime, /"circuit_open"/);
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

// The runtime reaches every service over PostgREST, which resolves RPC arguments by
// name. A service declared with anonymous parameters is therefore unreachable and
// silently degrades to an empty payload, which no positional pgTAP call can detect.
test('every service RPC is declared with the argument names the runtime sends', async () => {
  const namedArguments = await readFile('supabase/migrations/0066_recommendation_service_named_arguments.sql', 'utf8');
  const subjectScoped = [
    'similar_listings_service_v1',
    'seller_recommendations_service_v1',
    'related_services_service_v1',
    'related_products_service_v1',
    'nearby_service_v1',
  ];

  for (const routine of subjectScoped) {
    assert.match(
      namedArguments,
      new RegExp(String.raw`create function public\.${routine}\(\s+p_subject_listing_id uuid`),
      `${routine} must accept p_subject_listing_id by name`,
    );
    // Dropping to rename parameters creates new functions, so the 0027 execute
    // boundary has to be restated or Supabase default privileges re-expose them.
    assert.ok(
      namedArguments.includes(`revoke all on function public.${routine}(`),
      `${routine} must be revoked from browser roles after being recreated`,
    );
  }

  assert.match(namedArguments, /p_max_distance_meters integer default 50000/);
  assert.match(namedArguments, /p_cursor text default null/);
  assert.match(isolation, /p_viewer_id uuid/);
  assert.match(isolation, /create or replace function public\.recently_listed_service_v1\(\s+p_cursor text/);
});

test('a null cursor is accepted as the first-page signal', async () => {
  // The browser adapter always sends an explicit cursor key, null on the first page.
  assert.match(runtime, /body\.cursor !== undefined && body\.cursor !== null/);

  const adapter = await readFile('src/services/recommendationServices.js', 'utf8');
  assert.match(adapter, /cursor: normalizedCursor/);
  assert.match(adapter, /if \(value == null\) return null;/);
});
