import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The listing-expiry smoke test');
const workerSecret = process.env.FINDIT_LISTING_EXPIRY_WORKER_SECRET
  ?? (smokeTarget.label === 'local' ? secretKey : null);
if (!anonKey || !secretKey || !workerSecret) {
  throw new Error('Supabase publishable, secret, and listing-expiry worker keys are required.');
}

const root = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const workerUrl = `${url}/functions/v1/listing-expiry-worker`;
const stamp = Date.now();
const email = `findit-expiry-worker-${stamp}@example.test`;
const password = `FindIt!Expiry${stamp}`;
let ownerId;
let listingId;

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function invoke(apiKey, authorization) {
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: { apikey: apiKey, Authorization: authorization },
  });
  return { response, body: await response.json() };
}

try {
  ownerId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Expiry Worker Smoke' },
  }), 'create expiry owner').user.id;
  listingId = success(await root.from('listings').insert({
    kind: 'car',
    seller_id: ownerId,
    seller_name: 'Expiry Worker Smoke',
    title: 'Expiry worker vehicle',
    category: 'cars_sale',
    price: 9000,
    status: 'available',
    expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  }).select('id').single(), 'create expiring listing').id;
  success(await root.from('car_details').insert({
    listing_id: listingId,
    brand: 'Toyota',
    model: 'Corolla',
  }), 'create listing detail');

  const unauthorized = await invoke(anonKey, `Bearer ${anonKey}`);
  assert.equal(unauthorized.response.status, 401, 'expiry worker rejects a browser credential');

  const mixedCredential = await invoke(anonKey, `Bearer ${secretKey}`);
  assert.equal(
    mixedCredential.response.status,
    401,
    'expiry worker rejects secret authorization through a browser-key gateway request',
  );

  const workerApiKey = smokeTarget.label === 'local' ? secretKey : anonKey;
  const processed = await invoke(workerApiKey, `Bearer ${workerSecret}`);
  assert.equal(processed.response.status, 200, JSON.stringify(processed.body));
  assert.equal(processed.body.noticesCreated, 1);
  assert.equal(processed.body.listingsExpired, 0);

  const repeated = await invoke(workerApiKey, `Bearer ${workerSecret}`);
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.noticesCreated, 0, 'expiry worker is idempotent');

  const alerts = success(await root.from('app_alerts')
    .select('event_type,link')
    .eq('user_id', ownerId), 'read expiry notification');
  assert.deepEqual(alerts, [{ event_type: 'listing_expires_soon', link: '/my-listings' }]);

  console.log(`Phase 6 ${smokeTarget.label} listing expiry worker smoke: PASS`);
  console.log('Verified service-only auth, trusted notification creation, safe link, and idempotency.');
} finally {
  if (ownerId) {
    try { await root.from('app_alerts').delete().eq('user_id', ownerId); } catch { /* best effort */ }
  }
  if (listingId) {
    try { await root.from('listings').delete().eq('id', listingId); } catch { /* best effort */ }
  }
  if (ownerId) {
    try { await root.auth.admin.deleteUser(ownerId); } catch { /* best effort */ }
  }
}
