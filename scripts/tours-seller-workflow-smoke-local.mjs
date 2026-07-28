import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  cleanupTourFixtures,
  createListingWithStatus,
  createSmokeUser,
  createServiceWithStatus,
  createTourUpload,
  invokeFunction,
  root,
  setToursDatabaseEnabled,
  success,
  smokeTarget,
} from './lib/tour-smoke-fixtures.mjs';

const bytes = Buffer.from('findit-seller-tour-workflow-smoke');
let owner;
const listingIds = [];
const serviceIds = [];

try {
  owner = await createSmokeUser('tour-seller-workflow');
  await setToursDatabaseEnabled(true);

  const pendingListing = await createListingWithStatus(owner.userId, 'Pending review Tour upload', 'pending_review');
  listingIds.push(pendingListing);
  const pendingUpload = await createTourUpload({ owner, listingId: pendingListing, bytes });
  assert.ok(pendingUpload.tourId, 'a normal newly submitted listing accepts its optional Tour');

  const rejectedListing = await createListingWithStatus(owner.userId, 'Rejected listing Tour replacement', 'rejected');
  listingIds.push(rejectedListing);
  const rejectedUpload = await createTourUpload({ owner, listingId: rejectedListing, bytes });
  assert.ok(rejectedUpload.tourId, 'a rejected listing accepts a corrected Tour before resubmission');

  const unavailableListing = await createListingWithStatus(owner.userId, 'Unavailable listing Tour denial', 'unavailable');
  listingIds.push(unavailableListing);
  const denied = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: unavailableListing,
      filename: 'unavailable.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(denied.response.status, 403, 'unavailable parents remain closed to new Tour uploads');


  const renewalListing = await createListingWithStatus(owner.userId, 'Expired Tour authorization renewal', 'pending_review');
  listingIds.push(renewalListing);
  const renewalKey = crypto.randomUUID();
  const firstIntent = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: renewalListing,
      filename: 'renewal.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: renewalKey,
    },
  });
  assert.equal(firstIntent.response.status, 201, `initial renewal intent failed: ${JSON.stringify(firstIntent.body)}`);
  success(await root.from('listing_tour_upload_intents')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', firstIntent.body.intentId), 'expire Tour authorization fixture');

  const renewedIntent = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: renewalListing,
      filename: 'renewal.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: renewalKey,
    },
  });
  assert.equal(renewedIntent.response.status, 201, `renewed intent failed: ${JSON.stringify(renewedIntent.body)}`);
  assert.equal(renewedIntent.body.intentId, firstIntent.body.intentId, 'renewal preserves the upload intent identity');
  assert.equal(renewedIntent.body.tourId, firstIntent.body.tourId, 'renewal preserves the Tour identity');
  assert.equal(renewedIntent.body.path, firstIntent.body.path, 'renewal preserves the private source path');
  assert.ok(Date.parse(renewedIntent.body.expiresAt) > Date.now(), 'renewal returns a future expiry');

  const changedMetadataReuse = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: renewalListing,
      filename: 'changed-metadata.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 13,
      idempotencyKey: renewalKey,
    },
  });
  assert.equal(changedMetadataReuse.response.status, 400, 'the same idempotency key cannot authorize changed media metadata');

  const renewedUpload = await owner.browser.storage
    .from('tour-sources')
    .uploadToSignedUrl(renewedIntent.body.path, renewedIntent.body.uploadToken, bytes, {
      contentType: 'video/mp4',
      upsert: false,
    });
  success(renewedUpload, 'upload through renewed Tour authorization');
  const renewedComplete = await invokeFunction('tour-upload-complete', {
    accessToken: owner.session.access_token,
    body: { intentId: renewedIntent.body.intentId },
  });
  assert.equal(renewedComplete.response.status, 200, `renewed Tour completion failed: ${JSON.stringify(renewedComplete.body)}`);

  const staleRenewalListing = await createListingWithStatus(owner.userId, 'Unavailable parent renewal denial', 'pending_review');
  listingIds.push(staleRenewalListing);
  const staleRenewalKey = crypto.randomUUID();
  const staleIntent = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: staleRenewalListing,
      filename: 'stale-renewal.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: staleRenewalKey,
    },
  });
  assert.equal(staleIntent.response.status, 201, `stale renewal setup failed: ${JSON.stringify(staleIntent.body)}`);
  success(await root.from('listing_tour_upload_intents')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', staleIntent.body.intentId), 'expire stale renewal fixture');
  success(await root.from('listings')
    .update({ status: 'unavailable' })
    .eq('id', staleRenewalListing), 'make stale renewal parent unavailable');
  const staleRenewalDenied = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: staleRenewalListing,
      filename: 'stale-renewal.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: staleRenewalKey,
    },
  });
  assert.equal(staleRenewalDenied.response.status, 403, 'expired authorization cannot renew after parent unavailability');

  const lateCompletionListing = await createListingWithStatus(owner.userId, 'Late exact-object Tour confirmation', 'pending_review');
  listingIds.push(lateCompletionListing);
  const lateIntent = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'listing',
      parentId: lateCompletionListing,
      filename: 'late-completion.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(lateIntent.response.status, 201, `late completion intent failed: ${JSON.stringify(lateIntent.body)}`);
  success(await owner.browser.storage.from('tour-sources').uploadToSignedUrl(
    lateIntent.body.path,
    lateIntent.body.uploadToken,
    bytes,
    { contentType: 'video/mp4', upsert: false },
  ), 'upload late completion source');
  success(await root.from('listing_tour_upload_intents')
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', lateIntent.body.intentId), 'expire uploaded Tour intent before confirmation');
  const lateComplete = await invokeFunction('tour-upload-complete', {
    accessToken: owner.session.access_token,
    body: { intentId: lateIntent.body.intentId },
  });
  assert.equal(lateComplete.response.status, 200, `late exact-object completion failed: ${JSON.stringify(lateComplete.body)}`);

  const activeService = await createServiceWithStatus(owner.userId, 'Active mechanic service Tour', 'active', 'mechanic');
  serviceIds.push(activeService);
  const serviceUpload = await createTourUpload({ owner, serviceId: activeService, bytes });
  assert.ok(serviceUpload.tourId, 'an active non-legal service accepts a See their work Tour');

  const unavailableService = await createServiceWithStatus(owner.userId, 'Unavailable service Tour denial', 'unavailable', 'mechanic');
  serviceIds.push(unavailableService);
  const unavailableServiceDenied = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'service',
      parentId: unavailableService,
      filename: 'unavailable-service.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(unavailableServiceDenied.response.status, 403, 'unavailable services remain closed to new Tour uploads');

  const legalService = await createServiceWithStatus(owner.userId, 'Legal service Tour denial', 'active', 'legal');
  serviceIds.push(legalService);
  const legalServiceDenied = await invokeFunction('tour-upload-intent', {
    accessToken: owner.session.access_token,
    body: {
      parentType: 'service',
      parentId: legalService,
      filename: 'legal-service.mp4',
      mimeType: 'video/mp4',
      byteSize: bytes.length,
      durationSeconds: 12,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  assert.equal(legalServiceDenied.response.status, 403, 'legal service records cannot receive Tours in the MVP');

  console.log(`Tours ${smokeTarget.label} seller workflow passed: listing review states, same-intent renewal, stale-parent renewal denial, late exact-object confirmation, active service upload, unavailable-parent denial and legal-service exclusion.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  for (const listingId of listingIds) await cleanupTourFixtures({ listingId });
  for (const serviceId of serviceIds) await cleanupTourFixtures({ serviceId });
  await cleanupTourFixtures({ users: [owner].filter(Boolean) });
}
