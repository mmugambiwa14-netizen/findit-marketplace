import assert from 'node:assert/strict';
import {
  anonKey,
  claimTourProcessing,
  cleanupTourFixtures,
  createAvailableListing,
  createSmokeUser,
  createTourUpload,
  finalizeTourProcessing,
  invokeFunction,
  root,
  secretKey,
  setToursDatabaseEnabled,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

const sourceBytes = Buffer.from('findit-lifecycle-source-smoke');
let owner;
let admin;
let reporter;
let listingId;

async function prepareApprovedTour(label) {
  const upload = await createTourUpload({ owner, listingId, bytes: Buffer.concat([sourceBytes, Buffer.from(label)]) });
  const claim = await claimTourProcessing(upload.tourId);
  await finalizeTourProcessing(claim, {
    playbackBytes: Buffer.from(`playback-${label}`),
    thumbnailBytes: Buffer.from(`thumbnail-${label}`),
  });
  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: upload.tourId,
    p_reason: `Approve ${label} Tour lifecycle fixture`,
  }), `approve ${label} Tour`);
  return upload;
}

try {
  owner = await createSmokeUser('tour-lifecycle-owner');
  admin = await createSmokeUser('tour-lifecycle-admin', 'admin');
  reporter = await createSmokeUser('tour-lifecycle-reporter');
  listingId = await createAvailableListing(owner.userId, 'Atomic Tour lifecycle smoke');
  await setToursDatabaseEnabled(true);

  const first = await prepareApprovedTour('first');
  let slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id').eq('listing_id', listingId).single(), 'read first current Tour');
  assert.equal(slot.current_tour_id, first.tourId);

  const failed = await createTourUpload({ owner, listingId, bytes: Buffer.concat([sourceBytes, Buffer.from('failed')]) });
  const failedClaim = await claimTourProcessing(failed.tourId);
  const failedResult = success(await root.rpc('fail_tour_processing', {
    p_tour_id: failed.tourId,
    p_lease_token: failedClaim.lease_token,
    p_failure_code: 'fixture_failure',
    p_failure_message: 'Intentional lifecycle fixture failure.',
    p_retryable: false,
  }), 'fail replacement Tour');
  assert.equal(failedResult, true);
  slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id').eq('listing_id', listingId).single(), 'read failed replacement slot');
  assert.equal(slot.current_tour_id, first.tourId, 'failed replacement preserves current public Tour');
  assert.equal(slot.pending_tour_id, failed.tourId);

  const third = await createTourUpload({ owner, listingId, bytes: Buffer.concat([sourceBytes, Buffer.from('third')]) });
  const removedFailed = success(await root.from('listing_tours')
    .select('status,processing_retry_at').eq('id', failed.tourId).single(), 'read replaced failure');
  assert.equal(removedFailed.status, 'removed', 'starting a new replacement retires the failed pending version');
  assert.equal(removedFailed.processing_retry_at, null);
  const failedCleanup = success(await root.from('tour_asset_cleanup_queue')
    .select('reason,state').eq('tour_id', failed.tourId).eq('reason', 'terminal_media').single(), 'read failed replacement cleanup');
  assert.equal(failedCleanup.state, 'pending');

  const thirdClaim = await claimTourProcessing(third.tourId);
  await finalizeTourProcessing(thirdClaim, {
    playbackBytes: Buffer.from('playback-third'),
    thumbnailBytes: Buffer.from('thumbnail-third'),
  });
  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: third.tourId,
    p_reason: 'Approve atomic replacement fixture',
  }), 'approve replacement Tour');

  slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id').eq('listing_id', listingId).single(), 'read promoted replacement slot');
  assert.equal(slot.current_tour_id, third.tourId);
  assert.equal(slot.pending_tour_id, null);
  assert.equal(success(await root.from('listing_tours').select('status').eq('id', first.tourId).single(), 'read superseded Tour').status, 'superseded');

  const reportId = success(await reporter.browser.rpc('report_tour', {
    p_tour_id: third.tourId,
    p_reason: 'misleading_representation',
    p_description: 'Intentional lifecycle report fixture.',
  }), 'report current Tour');
  assert.ok(reportId);
  assert.equal(success(await root.from('listing_tours').select('moderation_status,published_at').eq('id', third.tourId).single(), 'read reported Tour').moderation_status, 'reported');
  const hidden = await invokeFunction('tour-playback-access', { body: { parentType: 'listing', parentId: listingId } });
  assert.equal(hidden.response.status, 404, 'reported Tour leaves public playback immediately');

  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: third.tourId,
    p_reason: 'Restore the reported lifecycle fixture after review',
  }), 'restore reported Tour');
  const restored = success(await root.from('listing_tours').select('moderation_status,published_at').eq('id', third.tourId).single(), 'read restored Tour');
  assert.equal(restored.moderation_status, 'approved');
  assert.ok(restored.published_at, 'reapproval restores publication timestamp');

  success(await owner.browser.rpc('owner_remove_tour', { p_tour_id: third.tourId }), 'owner removes current Tour');
  slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id').eq('listing_id', listingId).single(), 'read removed slot');
  assert.equal(slot.current_tour_id, null);

  success(await root.from('tour_asset_cleanup_queue')
    .update({ eligible_at: new Date(Date.now() - 1000).toISOString() })
    .eq('tour_id', third.tourId), 'make removal cleanup eligible');
  const workerSecret = process.env.FINDIT_TOUR_CLEANUP_WORKER_SECRET
    ?? (smokeTarget.label === 'local' ? secretKey : null);
  assert.ok(workerSecret, 'FINDIT_TOUR_CLEANUP_WORKER_SECRET is required');
  const cleanup = await invokeFunction('tour-lifecycle-cleanup', {
    apiKey: smokeTarget.label === 'local' ? secretKey : anonKey,
    authorization: `Bearer ${workerSecret}`,
    body: { batchSize: 100 },
  });
  assert.ok([200, 207].includes(cleanup.response.status), `Tour cleanup worker failed: ${JSON.stringify(cleanup.body)}`);
  assert.ok(cleanup.body.claimed >= 1, 'Tour cleanup claims terminal media');

  const invalidations = success(await root.from('tour_cache_invalidations')
    .select('reason,processed_at').eq('parent_id', listingId), 'read cache invalidations');
  assert.ok(invalidations.some((row) => row.reason === 'current_tour_changed'));
  assert.ok(invalidations.some((row) => row.reason === 'tour_state_changed'));

  const cacheSecret = process.env.FINDIT_TOUR_CACHE_WORKER_SECRET
    ?? (smokeTarget.label === 'local' ? secretKey : null);
  assert.ok(cacheSecret, 'FINDIT_TOUR_CACHE_WORKER_SECRET is required');
  const cache = await invokeFunction('tour-cache-invalidation', {
    apiKey: smokeTarget.label === 'local' ? secretKey : anonKey,
    authorization: `Bearer ${cacheSecret}`,
    body: { batchSize: 500 },
  });
  assert.equal(cache.response.status, 200, `cache invalidation worker failed: ${JSON.stringify(cache.body)}`);
  assert.ok(cache.body.finalized >= 1);

  console.log(`Tours ${smokeTarget.label} lifecycle smoke passed: failed replacement preservation, atomic promotion, reporting, restoration, removal, cleanup and cache invalidation.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  await cleanupTourFixtures({ listingId, users: [owner, admin, reporter].filter(Boolean) });
}
