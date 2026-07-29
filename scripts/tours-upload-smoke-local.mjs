import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  cleanupTourFixtures,
  createAvailableListing,
  createTourIntent,
  createSmokeUser,
  createTourUpload,
  invokeFunction,
  root,
  setToursDatabaseEnabled,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

const bytes = Buffer.from('findit-direct-tour-upload-smoke');
let owner;
let stranger;
let listingId;
let uploaded;

try {
  owner = await createSmokeUser('tour-upload-owner');
  stranger = await createSmokeUser('tour-upload-stranger');
  listingId = await createAvailableListing(owner.userId, 'Direct Tour upload smoke');
  await setToursDatabaseEnabled(true);

  const unauthenticated = await invokeFunction('tour-upload-intent', {
    body: {
      parentType: 'listing',
      parentId: listingId,
      filename: 'unauthenticated.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 10,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(unauthenticated.response.status, 401, 'Tour intent requires authentication');

  const crossOwner = await invokeFunction('tour-upload-intent', {
    accessToken: stranger.session.access_token,
    body: {
      parentType: 'listing',
      parentId: listingId,
      filename: 'cross-owner.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 10,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(crossOwner.response.status, 403, 'a different user cannot upload for this listing');

  const tooLong = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: listingId,
      filename: 'too-long.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 121,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(tooLong.response.status, 422, 'the two-minute boundary is enforced before authorization');

  const idempotencyKey = crypto.randomUUID();
  const intentRequest = {
    owner,
    parentType: 'listing',
    parentId: listingId,
    bytes,
    durationSeconds: 10,
    idempotencyKey,
  };
  const intent = await createTourIntent(intentRequest);
  assert.equal(intent.response.status, 201, `initial intent failed: ${JSON.stringify(intent.body)}`);
  const repeated = await createTourIntent(intentRequest);
  assert.equal(repeated.response.status, 201, `authorized idempotent intent failed: ${JSON.stringify(repeated.body)}`);
  assert.equal(repeated.body.intentId, intent.body.intentId);
  assert.equal(repeated.body.tourId, intent.body.tourId);
  assert.equal(repeated.body.path, intent.body.path);

  uploaded = await createTourUpload({
    owner,
    listingId,
    bytes,
    idempotencyKey,
    intent,
  });

  const duplicateComplete = await invokeFunction('tour-upload-complete', {
    accessToken: owner.session.access_token,
    body: { intentId: uploaded.intentId },
  });
  assert.equal(duplicateComplete.response.status, 200, 'duplicate completion is idempotent');
  assert.equal(duplicateComplete.body.tourId, uploaded.tourId);

  const tour = success(await root.from('listing_tours')
    .select('status,owner_id,listing_id,source_storage_path')
    .eq('id', uploaded.tourId)
    .single(), 'read uploaded Tour');
  assert.equal(tour.status, 'uploaded');
  assert.equal(tour.owner_id, owner.userId);
  assert.equal(tour.listing_id, listingId);
  assert.equal(tour.source_storage_path, uploaded.path);

  const slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id')
    .eq('listing_id', listingId)
    .single(), 'read Tour slot');
  assert.equal(slot.current_tour_id, null);
  assert.equal(slot.pending_tour_id, uploaded.tourId);

  console.log(`Tours ${smokeTarget.label} upload smoke passed: auth, ownership, limits, signed direct upload, completion and idempotency.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  await cleanupTourFixtures({ listingId, users: [owner, stranger].filter(Boolean) });
}
