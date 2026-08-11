import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';
import { grantCuratedPublishing } from './lib/curated-publisher-smoke-fixtures.mjs';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(supabaseUrl, 'The services smoke test');
if (!anonKey || !secretKey) {
  throw new Error('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are required.');
}

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } };
const admin = createClient(supabaseUrl, secretKey, options);
const owner = createClient(supabaseUrl, anonKey, options);
const guest = createClient(supabaseUrl, anonKey, options);
const stamp = Date.now();
const email = `findit-services-smoke-${stamp}@example.test`;
const password = `FindIt!Services${stamp}`;
const functionUrl = `${supabaseUrl}/functions/v1/marketplace-image-upload`;
const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const metadataPayload = Buffer.from('FindIt\0GPS=-17.8252,31.0335', 'utf8');
const metadataChunk = Buffer.alloc(12 + metadataPayload.length);
metadataChunk.writeUInt32BE(metadataPayload.length, 0);
metadataChunk.write('tEXt', 4, 4, 'ascii');
metadataPayload.copy(metadataChunk, 8);
const pngWithMetadata = Buffer.concat([onePixelPng.subarray(0, 33), metadataChunk, onePixelPng.subarray(33)]);
let userId;
const serviceIds = [];
const storagePaths = [];

function success(result, label) {
  assert.equal(result.error, null, `${label} failed: ${result.error?.message}`);
  return result.data;
}

async function uploadImage(accessToken, purpose) {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', new File([pngWithMetadata], `${purpose}.png`, { type: 'image/png' }));
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, Origin: smokeTarget.origin },
    body: form,
  });
  const body = await response.json();
  assert.equal(response.status, 201, `upload ${purpose} failed: ${JSON.stringify(body)}`);
  assert.equal(body.metadataRemoved, true, `${purpose} upload must strip image metadata`);
  assert.equal(body.byteSize, onePixelPng.length, `${purpose} stored size must describe sanitized bytes`);
  storagePaths.push(body.path);
  return body;
}

try {
  const created = success(await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Service Smoke' },
  }), 'create owner');
  userId = created.user.id;
  const login = success(await owner.auth.signInWithPassword({ email, password }), 'owner sign in');
  await grantCuratedPublishing(admin, userId, ['service'], 'Services smoke publisher');

  for (const status of ['active', 'paused']) {
    const row = success(await owner.from('services').insert({
      provider_id: userId,
      provider_name: 'Service Smoke',
      contact_phone: '+263771234567',
      contact_email: email,
      title: `${status} mechanic service`,
      category: 'mechanic',
      subcategory: 'maintenance_repair',
      subcategories: ['maintenance_repair'],
      price: 25,
      pricing_type: 'starting_from',
      status,
    }).select('id,status').single(), `insert ${status} service`);
    serviceIds.push(row.id);
  }

  const upload = await uploadImage(login.session.access_token, 'service_photo');
  const hiddenBeforeAttachment = await guest.storage.from('marketplace-images').createSignedUrl(upload.path, 60);
  assert.ok(hiddenBeforeAttachment.error, 'an unattached service image must not be signable by a guest');
  success(await owner.rpc('attach_marketplace_image', {
    p_intent_id: upload.intentId,
    p_storage_path: upload.path,
    p_target_kind: 'service',
    p_target_id: serviceIds[0],
    p_display_order: 0,
  }), 'attach service image');
  const attached = success(await owner.from('services').select('photos').eq('id', serviceIds[0]).single(), 'read attached service image');
  assert.deepEqual(attached.photos, [upload.path]);
  const publicSigned = success(await guest.storage.from('marketplace-images').createSignedUrl(upload.path, 60), 'sign public service image');
  const downloaded = await fetch(publicSigned.signedUrl);
  assert.equal(downloaded.status, 200, 'signed service image download failed');
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), onePixelPng);
  const photoBypass = await owner.from('services').update({ photos: ['https://evil.example/image.png'] }).eq('id', serviceIds[0]);
  assert.ok(photoBypass.error, 'an owner cannot bypass trusted service image attachment');

  const replacementUpload = await uploadImage(login.session.access_token, 'service_photo');
  const replacement = success(await owner.rpc('replace_service_media', {
    p_service_id: serviceIds[0],
    p_keep_paths: [],
    p_new_media: [{ intentId: replacementUpload.intentId, path: replacementUpload.path }],
  }), 'replace service image');
  assert.deepEqual(replacement.photos, [replacementUpload.path]);
  assert.deepEqual(replacement.removedPaths, [upload.path]);
  const hiddenAfterReplacement = await guest.storage.from('marketplace-images').createSignedUrl(upload.path, 60);
  assert.ok(hiddenAfterReplacement.error, 'a detached service image must no longer be signable by a guest');
  success(await owner.storage.from('marketplace-images').remove([upload.path]), 'delete detached service image');
  const replacementSigned = success(await guest.storage.from('marketplace-images').createSignedUrl(replacementUpload.path, 60), 'sign replacement service image');
  const replacementDownload = await fetch(replacementSigned.signedUrl);
  assert.equal(replacementDownload.status, 200, 'replacement service image download failed');
  assert.deepEqual(Buffer.from(await replacementDownload.arrayBuffer()), onePixelPng);

  const publicRows = success(await guest.from('services')
    .select('id,title,status,category')
    .eq('status', 'active')
    .neq('category', 'legal')
    .eq('provider_id', userId), 'public service list');
  assert.equal(publicRows.length, 1, 'guest must see only the active V1 service');

  const publicDetail = success(await guest.from('services')
    .select('id,title,status')
    .eq('id', serviceIds[0])
    .eq('status', 'active')
    .single(), 'public service detail');
  assert.equal(publicDetail.id, serviceIds[0]);

  const ownerRows = success(await owner.from('services')
    .select('id,status')
    .eq('provider_id', userId), 'owner service list');
  assert.equal(ownerRows.length, 2, 'owner must see active and paused services');

  const paused = success(await owner.from('services')
    .update({ status: 'paused', title: 'paused by owner' })
    .eq('provider_id', userId)
    .eq('id', serviceIds[0])
    .select('id,status,title')
    .single(), 'owner service update');
  assert.equal(paused.status, 'paused');
  const hiddenAfterPause = await guest.storage.from('marketplace-images').createSignedUrl(replacementUpload.path, 60);
  assert.ok(hiddenAfterPause.error, 'pausing a service must hide its private image');

  const deleted = success(await owner.from('services')
    .delete()
    .eq('provider_id', userId)
    .eq('id', serviceIds[1])
    .select('id')
    .single(), 'owner service delete');
  assert.equal(deleted.id, serviceIds[1]);
  serviceIds.splice(1, 1);

  console.log(`Phase 3 ${smokeTarget.label} services smoke: PASS`);
  console.log('Verified public visibility plus owner create, atomic image replacement, update, pause, and delete.');
} finally {
  if (userId) await admin.from('services').delete().eq('provider_id', userId);
  if (storagePaths.length) await admin.storage.from('marketplace-images').remove(storagePaths);
  await owner.auth.signOut();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
