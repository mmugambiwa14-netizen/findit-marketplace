import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './smoke-target.mjs';

export const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
export const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
export const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
export const smokeTarget = assertSmokeTarget(url, 'The Tours smoke test');

if (!anonKey || !secretKey) {
  throw new Error('Supabase publishable and secret keys are required for Tours smoke tests.');
}

export const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
export const root = createClient(url, secretKey, clientOptions);

export function client() {
  return createClient(url, anonKey, clientOptions);
}

export function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

export async function createSmokeUser(prefix, role = 'user') {
  const stamp = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${prefix}-${stamp}@example.test`;
  const password = `FindIt-${crypto.randomBytes(24).toString('base64url')}!9aA`;
  const userId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${prefix} smoke` },
  }), `create ${prefix}`).user.id;
  if (role === 'admin') {
    success(await root.from('users').update({ role: 'admin', super_admin: true }).eq('id', userId), `grant ${prefix} admin`);
  }
  const browser = client();
  const session = success(await browser.auth.signInWithPassword({ email, password }), `sign in ${prefix}`).session;
  return { userId, email, password, browser, session };
}

export async function createListingWithStatus(ownerId, title = 'Tour smoke listing', status = 'available') {
  const data = success(await root.from('listings').insert({
    kind: 'car',
    seller_id: ownerId,
    seller_name: 'Tour smoke owner',
    title,
    description: 'A listing fixture used only for the isolated Tours lifecycle smoke suite.',
    price: 12000,
    currency: 'USD',
    category: 'cars_sale',
    listing_type: 'sale',
    status,
  }).select('id').single(), `create ${status} Tour listing`);
  return data.id;
}

export function createAvailableListing(ownerId, title = 'Tour smoke listing') {
  return createListingWithStatus(ownerId, title, 'available');
}

export async function createServiceWithStatus(ownerId, title = 'Tour smoke service', status = 'active', category = 'mechanic') {
  const data = success(await root.from('services').insert({
    provider_id: ownerId,
    provider_name: 'Tour smoke owner',
    contact_phone: '+263771234567',
    title,
    description: 'A service fixture used only for the isolated Tours seller workflow smoke suite.',
    category,
    subcategory: category === 'legal' ? 'general' : 'maintenance_repair',
    subcategories: [category === 'legal' ? 'general' : 'maintenance_repair'],
    pricing_type: 'starting_from',
    status,
  }).select('id').single(), `create ${status} ${category} Tour service`);
  return data.id;
}

export async function setToursDatabaseEnabled(enabled) {
  success(await root.rpc('set_backend_feature_enabled', {
    p_feature_key: 'tours',
    p_enabled: enabled,
    p_configuration: {
      maxDurationSeconds: 120,
      maxSourceBytes: 262144000,
      publicHeight: 720,
      sourceRetentionDays: 7,
      maxProcessingAttempts: 3,
    },
  }), `${enabled ? 'enable' : 'disable'} Tours database feature`);
}

/**
 * @typedef {{ accessToken?: string, body?: Record<string, unknown>, authorization?: string, apiKey?: string }} InvokeFunctionOptions
 */

/**
 * @param {string} name
 * @param {InvokeFunctionOptions} [options]
 * @returns {Promise<{ response: Response, body: any }>}
 */
export async function invokeFunction(name, { accessToken, body = {}, authorization, apiKey = anonKey } = {}) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      ...(authorization
        ? { Authorization: authorization }
        : accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
      Origin: smokeTarget.origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* response contract assertion follows */ }
  return { response, body: payload };
}

/**
 * @param {{
 *   owner: any,
 *   listingId?: string,
 *   serviceId?: string,
 *   parentType?: 'listing' | 'service',
 *   parentId?: string,
 *   bytes: Uint8Array,
 *   durationSeconds?: number,
 *   idempotencyKey?: string,
 *   intent?: { response: Response, body: any } | null
 * }} input
 * @returns {Promise<any>}
 */
export async function createTourUpload({
  owner,
  listingId,
  serviceId,
  parentType = serviceId ? 'service' : 'listing',
  parentId = serviceId ?? listingId,
  bytes,
  durationSeconds = 10,
  idempotencyKey = crypto.randomUUID(),
  intent: suppliedIntent = null,
}) {
  assert.ok(parentId, 'a Tour smoke parent is required');
  const intent = suppliedIntent ?? await createTourIntent({
    owner,
    parentType,
    parentId,
    bytes,
    durationSeconds,
    idempotencyKey,
  });
  assert.equal(intent.response.status, 201, `Tour intent failed: ${JSON.stringify(intent.body)}`);
  assert.match(intent.body.path, new RegExp(`^${owner.userId}/[0-9a-f-]{36}/source/[0-9a-f-]{36}\\.mp4$`));

  const uploaded = await owner.browser.storage
    .from('tour-sources')
    .uploadToSignedUrl(intent.body.path, intent.body.uploadToken, bytes, {
      contentType: 'video/mp4',
      upsert: false,
    });
  success(uploaded, 'upload Tour source');

  const completed = await invokeFunction('tour-upload-complete', {
    accessToken: owner.session.access_token,
    body: { intentId: intent.body.intentId },
  });
  assert.equal(completed.response.status, 200, `Tour completion failed: ${JSON.stringify(completed.body)}`);
  assert.equal(completed.body.tourId, intent.body.tourId);
  return { ...intent.body, idempotencyKey };
}

export async function createTourIntent({
  owner,
  parentType = 'listing',
  parentId,
  bytes,
  durationSeconds = 10,
  idempotencyKey = crypto.randomUUID(),
}) {
  return invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType,
      parentId,
      filename: 'tour-smoke.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds,
      idempotencyKey,
    },
  });
}

export async function claimTourProcessing(tourId) {
  const claims = success(await root.rpc('claim_tour_processing_jobs', { p_batch_size: 20 }), 'claim Tour processing');
  const claim = claims.find((item) => item.tour_id === tourId);
  assert.ok(claim, `Tour ${tourId} was not claimable for processing`);
  return claim;
}

export async function finalizeTourProcessing(claim, {
  playbackBytes = Buffer.from('findit-tour-playback'),
  thumbnailBytes = Buffer.from('findit-tour-thumbnail'),
  durationSeconds = 10,
} = {}) {
  success(await root.storage.from('tour-playback').upload(claim.playback_storage_path, playbackBytes, {
    contentType: 'video/mp4',
    upsert: true,
  }), 'upload derived Tour playback');
  success(await root.storage.from('tour-thumbnails').upload(claim.thumbnail_storage_path, thumbnailBytes, {
    contentType: 'image/webp',
    upsert: true,
  }), 'upload derived Tour thumbnail');

  const finalized = success(await root.rpc('finalize_tour_processing', {
    p_tour_id: claim.tour_id,
    p_lease_token: claim.lease_token,
    p_duration_seconds: durationSeconds,
    p_width: 1280,
    p_height: 720,
    p_processed_byte_size: playbackBytes.length,
    p_detected_container: 'mp4',
    p_detected_video_codec: 'h264',
    p_detected_audio_codec: 'aac',
    p_checksum_sha256: crypto.createHash('sha256').update(playbackBytes).digest('hex'),
  }), 'finalize Tour processing');
  assert.equal(finalized, true, 'Tour processing finalization must own the active lease');
  return { playbackBytes, thumbnailBytes };
}

export async function removeTourObjects(tourRows = []) {
  const source = tourRows.map((row) => row.source_storage_path).filter(Boolean);
  const playback = tourRows.map((row) => row.playback_storage_path).filter(Boolean);
  const thumbnails = tourRows.map((row) => row.thumbnail_storage_path).filter(Boolean);
  if (source.length) await root.storage.from('tour-sources').remove(source);
  if (playback.length) await root.storage.from('tour-playback').remove(playback);
  if (thumbnails.length) await root.storage.from('tour-thumbnails').remove(thumbnails);
}

/**
 * @param {{ listingId?: string, serviceId?: string, users?: any[] }} [input]
 */
export async function cleanupTourFixtures({ listingId, serviceId, users = [] } = {}) {
  const parentColumn = listingId ? 'listing_id' : serviceId ? 'service_id' : null;
  const parentId = listingId ?? serviceId ?? null;
  if (parentColumn && parentId) {
    const result = await root.from('listing_tours')
      .select('id,source_storage_path,playback_storage_path,thumbnail_storage_path')
      .eq(parentColumn, parentId);
    const rows = result.data ?? [];
    await removeTourObjects(rows);
    const tourIds = rows.map((row) => row.id);
    if (tourIds.length) {
      await root.from('reports').delete().in('tour_id', tourIds);
      await root.from('listing_tour_events').delete().in('tour_id', tourIds);
      await root.from('listing_tour_upload_intents').delete().in('tour_id', tourIds);
    }
    await root.from('listing_tour_slots').delete().eq(parentColumn, parentId);
    await root.from('listing_tours').delete().eq(parentColumn, parentId);
    if (tourIds.length) await root.from('tour_asset_cleanup_queue').delete().in('tour_id', tourIds);
    await root.from('tour_cache_invalidations').delete().eq('parent_id', parentId);
    if (listingId) await root.from('listings').delete().eq('id', listingId);
    if (serviceId) await root.from('services').delete().eq('id', serviceId);
  }
  for (const user of users) {
    try { await user.browser?.auth.signOut(); } catch { /* best effort */ }
    if (user.userId) {
      try { await root.auth.admin.deleteUser(user.userId); } catch { /* best effort */ }
    }
  }
}
