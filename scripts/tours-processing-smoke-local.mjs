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
let listingId;
let uploaded;
let mediaDirectory;

try {
  await assertMediaToolchain();
  mediaDirectory = await mkdtemp(join(tmpdir(), 'findit-tour-smoke-'));
  const sourcePath = await createSyntheticTourSource(join(mediaDirectory, 'source.mp4'));
  const sourceBytes = await readFile(sourcePath);
  owner = await createSmokeUser('tour-processing-owner');
  listingId = await createAvailableListing(owner.userId, 'Tour processing smoke');
  await setToursDatabaseEnabled(true);

  uploaded = await createTourUpload({ owner, listingId, bytes: sourceBytes, durationSeconds: 2 });
  const claim = await claimTourProcessing(uploaded.tourId);
  assert.equal(claim.processing_attempt, 1);
  assert.equal(claim.source_storage_path, uploaded.path);

  const output = await processClaimedTour(root, claim);

  const ready = success(await root.from('listing_tours')
    .select('status,moderation_status,duration_seconds,processing_lease_token,playback_storage_path,thumbnail_storage_path,published_at')
    .eq('id', uploaded.tourId)
    .single(), 'read ready Tour');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.moderation_status, 'approved');
  assert.ok(ready.published_at, 'validated processing auto-publishes the Peek');
  assert.ok(Number(ready.duration_seconds) > 1.5 && Number(ready.duration_seconds) <= 2.1);
  assert.equal(ready.processing_lease_token, null);

  const playback = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(playback.response.status, 200, `public playback failed: ${JSON.stringify(playback.body)}`);
  assert.equal(playback.body.tourId, uploaded.tourId);
  assert.ok(Number(playback.body.durationSeconds) > 1.5 && Number(playback.body.durationSeconds) <= 2.1);
  const autoApprovalEvent = success(await root.from('listing_tour_events')
    .select('event_type,actor_type')
    .eq('tour_id', uploaded.tourId)
    .eq('event_type', 'tour_auto_approved')
    .single(), 'read automatic Peek approval event');
  assert.deepEqual(autoApprovalEvent, { event_type: 'tour_auto_approved', actor_type: 'system' });

  const slot = success(await root.from('listing_tour_slots')
    .select('current_tour_id,pending_tour_id')
    .eq('listing_id', listingId)
    .single(), 'read promoted Tour slot');
  assert.equal(slot.current_tour_id, uploaded.tourId);
  assert.equal(slot.pending_tour_id, null);

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

  console.log(`Tours ${smokeTarget.label} processing smoke passed: lease claim, validated outputs, automatic publication and private signed playback.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  await cleanupTourFixtures({ listingId, users: [owner].filter(Boolean) });
  if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true });
}
