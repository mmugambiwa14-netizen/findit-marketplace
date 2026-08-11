import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { grantCuratedPublishing } from './lib/curated-publisher-smoke-fixtures.mjs';
import { deleteDisposableFounder, signInFounder } from './lib/founder-smoke-fixtures.mjs';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The listing-creation smoke test');
if (!anonKey || !secretKey) throw new Error('A Supabase publishable key and secret key are required.');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const owner = createClient(url, anonKey, options);
const admin = createClient(url, anonKey, options);
const stranger = createClient(url, anonKey, options);
const guest = createClient(url, anonKey, options);
const stamp = Date.now();
const password = `FindIt-${crypto.randomBytes(24).toString('base64url')}!9aA`;
const ownerEmail = `findit-listing-owner-${stamp}@example.test`;
const strangerEmail = `findit-listing-stranger-${stamp}@example.test`;
const functionUrl = `${url}/functions/v1/listing-image-upload`;
let ownerId;
let adminId;
let strangerId;
let listingId;
let founder;
const storagePaths = [];

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function uploadRequest(accessToken, file, origin = smokeTarget.origin) {
  const form = new FormData();
  if (file) form.append('file', file);
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: form,
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { response, body };
}

function withPngTextMetadata(png) {
  const payload = Buffer.from('FindIt\0GPS=-17.8252,31.0335', 'utf8');
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write('tEXt', 4, 4, 'ascii');
  payload.copy(chunk, 8);
  // The sanitizer removes the complete ancillary chunk before delivery; its
  // CRC bytes are intentionally irrelevant to the resulting valid PNG.
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

try {
  ownerId = success(await root.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Listing Smoke Owner' },
  }), 'create owner').user.id;
  founder = await signInFounder({ root, browser: admin, smokeTarget, password, label: 'listing creation smoke' });
  adminId = founder.userId;
  strangerId = success(await root.auth.admin.createUser({
    email: strangerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Listing Smoke Stranger' },
  }), 'create stranger').user.id;
  await grantCuratedPublishing(root, ownerId, ['car'], 'Listing creation smoke publisher');

  const ownerSession = success(await owner.auth.signInWithPassword({ email: ownerEmail, password }), 'owner sign in').session;
  success(await stranger.auth.signInWithPassword({ email: strangerEmail, password }), 'stranger sign in');

  const noAuth = await uploadRequest(null, new File(['x'], 'x.png', { type: 'image/png' }));
  assert.equal(noAuth.response.status, 401, 'upload requires a valid session');

  const badOrigin = await uploadRequest(
    ownerSession.access_token,
    new File(['x'], 'x.png', { type: 'image/png' }),
    'https://untrusted.example',
  );
  assert.equal(badOrigin.response.status, 403, 'upload rejects an untrusted browser origin');

  const fakeImage = await uploadRequest(
    ownerSession.access_token,
    new File(['not really a PNG'], 'fake.png', { type: 'image/png' }),
  );
  assert.equal(fakeImage.response.status, 415, 'upload rejects content that only claims to be an image');

  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const uploaded = await uploadRequest(
    ownerSession.access_token,
    new File([withPngTextMetadata(pngBytes)], 'listing.png', { type: 'image/png' }),
  );
  assert.equal(uploaded.response.status, 201, `valid image upload failed: ${JSON.stringify(uploaded.body)}`);
  assert.equal(uploaded.body.mimeType, 'image/png');
  assert.equal(uploaded.body.width, 1);
  assert.equal(uploaded.body.height, 1);
  assert.equal(uploaded.body.metadataRemoved, true, 'listing upload must report stripped metadata');
  assert.equal(uploaded.body.byteSize, pngBytes.length, 'stored byte size must describe the sanitized image');
  assert.match(uploaded.body.path, new RegExp(`^${ownerId}/staging/[0-9a-f-]{36}\\.png$`));
  const storagePath = uploaded.body.path;
  storagePaths.push(storagePath);

  const submissionKey = crypto.randomUUID();
  const created = success(await owner.rpc('create_v1_listing_submission', {
    p_submission_key: submissionKey,
    p_listing: {
      kind: 'car',
      title: '2020 Toyota Hilux double cab',
      description: 'A carefully maintained vehicle with clear ownership contact details for this local smoke test.',
      category: 'cars_sale',
      listingType: 'sale',
      price: 24500,
      currency: 'USD',
      negotiable: true,
      locationId: '00000000-0000-4000-8000-000000000101',
      contactPhone: '+263771234567',
    },
    p_detail: { brand: 'Toyota', model: 'Hilux', year: '2020', mileage: '55000', fuelType: 'diesel', transmission: 'manual', condition: 'used' },
    p_media: [{ intentId: uploaded.body.intentId, path: storagePath }],
  }), 'submit listing');
  listingId = created.id;
  assert.equal(created.status, 'available');

  const retry = success(await owner.rpc('create_v1_listing_submission', {
    p_submission_key: submissionKey,
    p_listing: {},
    p_detail: {},
    p_media: [],
  }), 'idempotent retry');
  assert.equal(retry.id, listingId);
  assert.equal(retry.status, 'available');

  const publishedOwner = success(await owner.from('listings').select('id,status,expires_at').eq('id', listingId).single(), 'owner sees automatic publication');
  assert.equal(publishedOwner.status, 'available');
  assert.ok(publishedOwner.expires_at, 'automatic publication assigns a server-managed expiry');
  assert.equal(success(await stranger.from('listings').select('id').eq('id', listingId), 'stranger published read').length, 1);
  assert.equal(success(await guest.from('listings').select('id').eq('id', listingId), 'anonymous published read').length, 1);
  const initialReviewAlerts = success(await owner.from('app_alerts')
    .select('event_type')
    .eq('listing_id', listingId)
    .in('event_type', ['listing_approved', 'listing_rejected']), 'read automatic-publication alerts');
  assert.equal(initialReviewAlerts.length, 0, 'automatic publication must not claim a human review occurred');

  const signed = success(await guest.storage.from('listing-images').createSignedUrl(storagePath, 60), 'anonymous signed media read');
  const imageResponse = await fetch(signed.signedUrl);
  assert.equal(imageResponse.status, 200, 'approved listing image signed URL is downloadable');
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), pngBytes, 'downloaded image matches uploaded bytes');

  const directPhotoBypass = await owner.from('listings').update({ photos: ['https://evil.example/image.png'] }).eq('id', listingId);
  assert.ok(directPhotoBypass.error, 'an owner cannot bypass trusted listing image replacement');
  const replacementUpload = await uploadRequest(
    ownerSession.access_token,
    new File([pngBytes], 'listing-replacement.png', { type: 'image/png' }),
  );
  assert.equal(replacementUpload.response.status, 201, `replacement upload failed: ${JSON.stringify(replacementUpload.body)}`);
  storagePaths.push(replacementUpload.body.path);
  const replacement = success(await owner.rpc('replace_listing_media', {
    p_listing_id: listingId,
    p_keep_paths: [],
    p_new_media: [{ intentId: replacementUpload.body.intentId, path: replacementUpload.body.path }],
  }), 'replace listing image');
  assert.deepEqual(replacement.photos, [replacementUpload.body.path]);
  assert.deepEqual(replacement.removedPaths, [storagePath]);
  assert.equal(replacement.status, 'pending_review', 'editing live media must force review');
  const hiddenOld = await guest.storage.from('listing-images').createSignedUrl(storagePath, 60);
  assert.ok(hiddenOld.error, 'a detached listing image must no longer be signable by a guest');
  success(await owner.storage.from('listing-images').remove([storagePath]), 'delete detached listing image');
  success(await admin.rpc('admin_moderate_marketplace_item', {
    p_item_id: listingId,
    p_kind: 'car',
    p_action: 'publish',
    p_reason: 'Replacement image smoke approval',
  }), 'approve replacement image');
  const replacementAlert = success(await owner.from('app_alerts').select('event_type').eq('listing_id', listingId).eq('event_type', 'listing_approved').single(), 'owner replacement approval alert');
  assert.equal(replacementAlert.event_type, 'listing_approved');
  const replacementSigned = success(await guest.storage.from('listing-images').createSignedUrl(replacementUpload.body.path, 60), 'sign replacement listing image');
  const replacementResponse = await fetch(replacementSigned.signedUrl);
  assert.equal(replacementResponse.status, 200, 'replacement listing image download failed');
  assert.deepEqual(Buffer.from(await replacementResponse.arrayBuffer()), pngBytes);

  console.log(
    `Phase 4 ${smokeTarget.label} listing creation, trusted upload, and atomic image replacement smoke test passed.`,
  );
} finally {
  if (listingId) {
    await root.from('app_alerts').delete().eq('listing_id', listingId);
    await root.from('audit_logs').delete().eq('target_record_id', listingId);
    await root.from('listings').delete().eq('id', listingId);
  }
  if (storagePaths.length) {
    await root.storage.from('listing-images').remove(storagePaths);
    await root.from('listing_upload_intents').delete().in('storage_path', storagePaths);
  }
  await owner.auth.signOut();
  await admin.auth.signOut();
  await stranger.auth.signOut();
  if (ownerId) await root.auth.admin.deleteUser(ownerId);
  if (strangerId) await root.auth.admin.deleteUser(strangerId);
  await deleteDisposableFounder(root, founder);
}
