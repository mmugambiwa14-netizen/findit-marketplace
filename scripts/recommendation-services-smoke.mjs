import assert from 'node:assert/strict';

const baseUrl = process.env.FINDIT_RECOMMENDATION_SMOKE_URL?.replace(/\/$/, '');
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const healthSecret = process.env.FINDIT_RECOMMENDATION_HEALTH_SECRET;
const subjectListingId = process.env.FINDIT_RECOMMENDATION_SMOKE_LISTING_ID;

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

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${baseUrl}/functions/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: anonKey,
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
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
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, limit: 3 }),
  });
  assert.equal(response.status, 200, `${path} must fail soft`);
  const payload = await response.json();
  assert.equal(payload.contractVersion, 1);
  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.length <= 3);
  assert.ok('degraded' in payload);
}

const personalizedResponse = await request('personalized-recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 3 }),
});
assert.equal(personalizedResponse.status, 401, 'personalization must require authentication');

console.log('Recommendation service smoke checks passed.');
