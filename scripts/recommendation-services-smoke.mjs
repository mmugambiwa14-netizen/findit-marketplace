import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { resolveRecommendationRoute, withServiceField } from './lib/recommendation-endpoints.mjs';

const baseUrl = process.env.FINDIT_RECOMMENDATION_SMOKE_URL?.replace(/\/$/, '');
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const healthSecret = process.env.FINDIT_RECOMMENDATION_HEALTH_SECRET;
const subjectListingId = process.env.FINDIT_RECOMMENDATION_SMOKE_LISTING_ID;
const browserOrigin = process.env.FINDIT_RECOMMENDATION_SMOKE_ORIGIN ?? 'http://localhost:5173';

if (!baseUrl || !anonKey || !healthSecret) {
  console.error('Missing recommendation smoke environment.');
  process.exit(2);
}

const publicServices = [
  ['similar-listings', { subjectListingId }],
  ['seller-recommendations', { subjectListingId }],
  ['related-services', { subjectListingId }],
  ['related-products', { subjectListingId }],
  ['nearby-listings', { subjectListingId, maxDistanceMeters: 50000 }],
  ['recently-listed', {}],
];

const supabase = createClient(baseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      'x-client-info': 'findit-recommendation-smoke',
    },
  },
});

async function request(path, options = {}) {
  const { endpoint } = resolveRecommendationRoute(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${baseUrl}/functions/v1/${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: anonKey,
        Origin: browserOrigin,
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function preflight(path, requestHeaders = 'authorization, apikey, content-type, x-client-info') {
  const response = await request(path, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': requestHeaders,
    },
  });
  assert.equal(response.status, 204, `${path} preflight must be accepted`);
  assert.equal(response.headers.get('access-control-allow-origin'), browserOrigin, `${path} must echo the browser origin`);
  const allowedHeaders = response.headers.get('access-control-allow-headers') ?? '';
  for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) {
    assert.match(allowedHeaders, new RegExp(header, 'i'), `${path} CORS must allow ${header}`);
  }
}

const healthResponse = await request('recommendation-service-health', {
  method: 'GET',
  headers: { Authorization: `Bearer ${healthSecret}` },
});
assert.equal(healthResponse.status, 200, 'health endpoint must be available');
const health = await healthResponse.json();
assert.equal(health.contractVersion, 1);
assert.equal(health.serviceCount, 7);
assert.ok(Array.isArray(health.health?.services));

for (const [path, body] of publicServices) {
  if (path !== 'recently-listed' && !subjectListingId) continue;
  await preflight(path);
  const { endpoint } = resolveRecommendationRoute(path);
  const { data: payload, error } = await supabase.functions.invoke(endpoint, {
    body: withServiceField(path, { ...body, limit: 3 }),
    headers: { Origin: browserOrigin },
  });
  assert.equal(error, null, `${path} must not fail at the transport boundary`);
  assert.equal(payload.contractVersion, 1);
  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.length <= 3);
  assert.ok('degraded' in payload);
}

if (subjectListingId) {
  await preflight('contextual-ecosystem');
  const { data: contextualPayload, error: contextualError } = await supabase.functions.invoke('contextual-ecosystem', {
    body: { subjectListingId, maxSections: 6 },
    headers: { Origin: browserOrigin },
  });
  assert.equal(contextualError, null, 'contextual orchestration must not fail at the transport boundary');
  assert.equal(contextualPayload.contractVersion, 2);
  assert.equal(contextualPayload.subjectListingId, subjectListingId);
  assert.ok(Array.isArray(contextualPayload.sections));
}

const personalizedResponse = await request('personalized-recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 3 }),
});
assert.ok([401, 403].includes(personalizedResponse.status), 'personalization must require authentication');

console.log('Recommendation service smoke checks passed.');
