import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimTourProcessing,
  cleanupTourFixtures,
  createAvailableListing,
  createSmokeUser,
  createTourUpload,
  invokeFunction,
  root,
  setToursDatabaseEnabled,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';
import {
  assertMediaToolchain,
  createSyntheticTourSource,
  processClaimedTour,
} from './lib/tour-media-processor.mjs';

let owner;
let admin;
let listingId;
let uploaded;
let mediaDirectory;

try {
  await assertMediaToolchain();
  mediaDirectory = await mkdtemp(join(tmpdir(), 'findit-tour-smoke-'));
  const sourcePath = await createSyntheticTourSource(join(mediaDirectory, 'source.mp4'));
  const sourceBytes = await readFile(sourcePath);
  owner = await createSmokeUser('tour-processing-owner');
  admin = await createSmokeUser('tour-processing-admin', 'admin');
  listingId = await createAvailableListing(owner.userId, 'Tour processing smoke');
  await setToursDatabaseEnabled(true);

  uploaded = await createTourUpload({ owner, listingId, bytes: sourceBytes, durationSeconds: 2 });
  const claim = await claimTourProcessing(uploaded.tourId);
  assert.equal(claim.processing_attempt, 1);
  assert.equal(claim.source_storage_path, uploaded.path);

  const output = await processClaimedTour(root, claim);

  const ready = success(await root.from('listing_tours')
    .select('status,moderation_status,duration_seconds,processing_lease_token,playback_storage_path,thumbnail_storage_path')
    .eq('id', uploaded.tourId)
    .single(), 'read ready Tour');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.moderation_status, 'pending');
  assert.ok(Number(ready.duration_seconds) > 1.5 && Number(ready.duration_seconds) <= 2.1);
  assert.equal(ready.processing_lease_token, null);

  const beforeApproval = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(beforeApproval.response.status, 404, 'unapproved Tour is not publicly signable');

  const approved = success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: uploaded.tourId,
    p_reason: 'Tour processing smoke approval',
  }), 'approve ready Tour');
  assert.equal(approved, uploaded.tourId);

  const slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id')
    .eq('listing_id', listingId)
    .single(), 'read promoted Tour slot');
  assert.equal(slot.current_tour_id, uploaded.tourId);
  assert.equal(slot.pending_tour_id, null);

  const playback = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(playback.response.status, 200, `public playback failed: ${JSON.stringify(playback.body)}`);
  assert.equal(playback.body.tourId, uploaded.tourId);
  assert.ok(Number(playback.body.durationSeconds) > 1.5 && Number(playback.body.durationSeconds) <= 2.1);
  const playbackBytes = Buffer.from(await (await fetch(playback.body.playbackUrl)).arrayBuffer());
  const thumbnailBytes = Buffer.from(await (await fetch(playback.body.thumbnailUrl)).arrayBuffer());
  assert.equal(crypto.createHash('sha256').update(playbackBytes).digest('hex'), output.checksum);
  assert.equal(playbackBytes.length, output.processedByteSize);
  assert.equal(thumbnailBytes.length, output.thumbnailByteSize);

  await setToursDatabaseEnabled(false);
  const databaseDisabled = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(databaseDisabled.response.status, 404, 'database switch independently closes public playback');

  console.log(`Tours ${smokeTarget.label} processing smoke passed: lease claim, validated outputs, moderation promotion and private signed playback.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  await cleanupTourFixtures({ listingId, users: [owner, admin].filter(Boolean) });
  if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true });
}
