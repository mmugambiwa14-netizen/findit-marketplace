import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The media-lifecycle smoke test');
const workerSecret = process.env.FINDIT_MEDIA_CLEANUP_WORKER_SECRET
  ?? (smokeTarget.label === 'local' ? secretKey : null);
if (!anonKey || !secretKey || !workerSecret) {
  throw new Error('Supabase publishable, secret, and media-worker keys are required.');
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const owner = createClient(url, anonKey, options);
const stamp = Date.now();
const password = `FindIt!Cleanup${stamp}`;
const email = `findit-media-cleanup-${stamp}@example.test`;
const lifecycleUrl = `${url}/functions/v1/media-lifecycle-cleanup`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
let ownerId;
const paths = [];

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function upload(functionName, accessToken, purpose) {
  const form = new FormData();
  if (purpose) form.append('purpose', purpose);
  form.append('file', new File([png], `${purpose ?? 'listing'}.png`, { type: 'image/png' }));
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Origin: smokeTarget.origin,
    },
    body: form,
  });
  const body = await response.json();
  assert.equal(response.status, 201, `${functionName} failed: ${JSON.stringify(body)}`);
  paths.push({ bucket: functionName === 'listing-image-upload' ? 'listing-images' : 'marketplace-images', path: body.path });
  return body;
}

async function runCleanup(apiKey, authorization, batchSize = 10) {
  const response = await fetch(lifecycleUrl, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ batchSize }),
  });
  return { response, body: await response.json() };
}

try {
  ownerId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Media Cleanup Smoke' },
  }), 'create cleanup owner').user.id;
  const session = success(await owner.auth.signInWithPassword({ email, password }), 'sign in cleanup owner').session;

  const listing = await upload('listing-image-upload', session.access_token);
  const marketplace = await upload('marketplace-image-upload', session.access_token, 'service_photo');
  success(
    await root.from('listing_upload_intents')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', listing.intentId),
    'expire listing intent',
  );
  success(
    await root.from('marketplace_image_upload_intents')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', marketplace.intentId),
    'expire marketplace intent',
  );

  const unauthorized = await runCleanup(anonKey, `Bearer ${anonKey}`);
  assert.equal(unauthorized.response.status, 401, 'cleanup rejects a browser credential');

  const mixedCredential = await runCleanup(anonKey, `Bearer ${secretKey}`);
  assert.equal(
    mixedCredential.response.status,
    401,
    'cleanup rejects a secret authorization value sent through a browser-key gateway request',
  );

  const workerApiKey = smokeTarget.label === 'local' ? secretKey : anonKey;
  const cleaned = await runCleanup(workerApiKey, `Bearer ${workerSecret}`);
  assert.equal(cleaned.response.status, 200, `cleanup failed: ${JSON.stringify(cleaned.body)}`);
  assert.equal(cleaned.body.claimed, 2, 'cleanup claims both expired image intents');
  assert.equal(cleaned.body.cleaned, 2, 'cleanup removes both expired objects');
  assert.equal(cleaned.body.retryScheduled, 0);
  assert.equal(cleaned.body.finalizeFailures, 0);

  for (const item of paths) {
    const listed = success(
      await root.storage.from(item.bucket).list(item.path.slice(0, item.path.lastIndexOf('/'))),
      `list ${item.bucket} cleanup folder`,
    );
    assert.equal(listed.some((object) => item.path.endsWith(`/${object.name}`)), false, `${item.path} was removed`);
  }
  assert.equal(
    success(await root.from('listing_upload_intents').select('state,cleanup_attempts').eq('id', listing.intentId).single(), 'read listing cleanup').state,
    'cleaned',
  );
  assert.equal(
    success(await root.from('marketplace_image_upload_intents').select('state,cleanup_attempts').eq('id', marketplace.intentId).single(), 'read marketplace cleanup').state,
    'cleaned',
  );

  const repeated = await runCleanup(workerApiKey, `Bearer ${workerSecret}`);
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.body.claimed, 0, 'cleanup is idempotent after finalization');

  console.log(`Phase 4 ${smokeTarget.label} media lifecycle smoke passed: service-only auth, two-bucket cleanup, finalization and idempotency.`);
} finally {
  for (const item of paths) {
    try { await root.storage.from(item.bucket).remove([item.path]); } catch { /* best-effort fixture cleanup */ }
  }
  if (ownerId) {
    try { await root.auth.admin.deleteUser(ownerId); } catch { /* best-effort fixture cleanup */ }
  }
}
