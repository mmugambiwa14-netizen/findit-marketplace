import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  claimTourProcessing,
  cleanupTourFixtures,
  createAvailableListing,
  createSmokeUser,
  createTourUpload,
  finalizeTourProcessing,
  invokeFunction,
  root,
  setToursDatabaseEnabled,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

let owner;
let buyer;
let outsider;
let admin;
let listingId;
let imagePath;

try {
  owner = await createSmokeUser('tour-integration-owner');
  buyer = await createSmokeUser('tour-integration-buyer');
  outsider = await createSmokeUser('tour-integration-outsider');
  admin = await createSmokeUser('tour-integration-admin', 'admin');
  await setToursDatabaseEnabled(true);

  listingId = await createAvailableListing(owner.userId, 'Canonical Tour integration smoke');
  imagePath = `${owner.userId}/staging/${crypto.randomUUID()}.webp`;
  const imageBytes = Buffer.from('findit-saved-listing-image');
  success(await root.storage.from('listing-images').upload(imagePath, imageBytes, {
    contentType: 'image/webp',
    upsert: false,
  }), 'upload listing image fixture');
  success(await root.from('listing_media').insert({
    listing_id: listingId,
    owner_id: owner.userId,
    storage_path: imagePath,
    display_order: 0,
    mime_type: 'image/webp',
    byte_size: imageBytes.length,
    width_px: 16,
    height_px: 16,
    sha256_hex: crypto.createHash('sha256').update(imageBytes).digest('hex'),
  }), 'attach listing image fixture');
  success(await root.from('listings').update({ photos: [imagePath] }).eq('id', listingId), 'project listing photo path');

  success(await buyer.browser.from('saved_listings').insert({
    user_id: buyer.userId,
    listing_id: listingId,
  }), 'save canonical listing');

  const upload = await createTourUpload({
    owner,
    listingId,
    bytes: Buffer.from('findit-listing-integration-tour'),
    durationSeconds: 48,
  });
  const claim = await claimTourProcessing(upload.tourId);
  const derived = await finalizeTourProcessing(claim, { durationSeconds: 48 });
  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: upload.tourId,
    p_reason: 'Approve listing integration fixture',
  }), 'approve listing integration Tour');

  const summaries = success(await buyer.browser.rpc('public_tour_summaries', {
    p_listing_ids: [listingId],
    p_service_ids: [],
  }), 'read safe public Tour summary');
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].parent_id, listingId);
  assert.equal(Number(summaries[0].duration_seconds), 48);
  assert.deepEqual(
    Object.keys(summaries[0]).sort(),
    ['duration_seconds', 'parent_id', 'parent_type', 'published_at', 'tour_id'].sort(),
    'card summaries expose metadata only',
  );

  const playbackAccess = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(playbackAccess.response.status, 200, `signed playback access failed: ${JSON.stringify(playbackAccess.body)}`);
  assert.equal(playbackAccess.body.tourId, upload.tourId);
  assert.equal(playbackAccess.body.parentId, listingId);
  assert.ok(playbackAccess.body.playbackUrl);
  assert.ok(playbackAccess.body.thumbnailUrl);
  const playbackResponse = await fetch(playbackAccess.body.playbackUrl);
  assert.equal(playbackResponse.status, 200, 'signed playback URL must resolve');
  assert.deepEqual(Buffer.from(await playbackResponse.arrayBuffer()), derived.playbackBytes);
  const thumbnailResponse = await fetch(playbackAccess.body.thumbnailUrl);
  assert.equal(thumbnailResponse.status, 200, 'signed thumbnail URL must resolve');
  assert.deepEqual(Buffer.from(await thumbnailResponse.arrayBuffer()), derived.thumbnailBytes);

  const conversationId = success(await buyer.browser.rpc('start_listing_conversation', {
    p_listing_id: listingId,
    p_message: 'Is this still available?',
  }), 'start canonical listing conversation');
  assert.ok(conversationId);

  const inbox = success(await buyer.browser.rpc('message_inbox', {
    p_query: '', p_unread_only: false, p_limit: 50, p_offset: 0,
  }), 'read enriched message inbox');
  const inboxRow = inbox.find((row) => row.conversation_id === conversationId);
  assert.ok(inboxRow);
  assert.equal(inboxRow.listing_status, 'available');
  assert.equal(inboxRow.has_tour, true);
  assert.equal(Number(inboxRow.tour_duration_seconds), 48);

  success(await root.from('listings').update({ status: 'sold' }).eq('id', listingId), 'mark listing sold');

  const outsiderRead = success(await outsider.browser.from('listings')
    .select('id,status').eq('id', listingId), 'check public sold-listing exclusion');
  assert.equal(outsiderRead.length, 0, 'sold listing leaves public browse');

  const savedRead = success(await buyer.browser.from('listings')
    .select('id,status,photos').eq('id', listingId).single(), 'read saved unavailable listing');
  assert.equal(savedRead.status, 'sold');
  assert.deepEqual(savedRead.photos, [imagePath]);

  const savedMedia = success(await buyer.browser.from('listing_media')
    .select('storage_path').eq('listing_id', listingId).single(), 'read saved unavailable media metadata');
  assert.equal(savedMedia.storage_path, imagePath);
  const signedImage = success(await buyer.browser.storage.from('listing-images')
    .createSignedUrl(imagePath, 60), 'sign saved unavailable listing image');
  assert.ok(signedImage.signedUrl, 'saved unavailable image remains signable');

  success(await buyer.browser.from('saved_listings')
    .delete().eq('listing_id', listingId), 'remove saved entitlement before chat-context check');
  const conversationListing = success(await buyer.browser.from('listings')
    .select('id,status,photos').eq('id', listingId).single(), 'read unavailable listing through existing conversation');
  assert.equal(conversationListing.status, 'sold');
  const conversationMedia = success(await buyer.browser.from('listing_media')
    .select('storage_path').eq('listing_id', listingId).single(), 'read unavailable media through existing conversation');
  assert.equal(conversationMedia.storage_path, imagePath);
  const conversationSignedImage = success(await buyer.browser.storage.from('listing-images')
    .createSignedUrl(imagePath, 60), 'sign unavailable listing image through existing conversation');
  assert.ok(conversationSignedImage.signedUrl, 'chat View listing retains media after saved entitlement is removed');

  const hiddenSummaries = success(await buyer.browser.rpc('public_tour_summaries', {
    p_listing_ids: [listingId],
    p_service_ids: [],
  }), 'confirm unavailable Tour exclusion');
  assert.equal(hiddenSummaries.length, 0, 'sold listing leaves Tour discovery');

  const hiddenPlayback = await invokeFunction('tour-playback-access', {
    body: { parentType: 'listing', parentId: listingId },
  });
  assert.equal(hiddenPlayback.response.status, 404, 'sold listing revokes new signed Tour playback access');

  const context = success(await buyer.browser.rpc('message_conversation', {
    p_conversation_id: conversationId,
  }), 'read preserved unavailable conversation');
  assert.equal(context.listing_status, 'sold');
  assert.equal(context.has_tour, false);
  assert.equal(context.listing_title, 'Canonical Tour integration smoke');

  const deniedConversation = await outsider.browser.rpc('start_listing_conversation', {
    p_listing_id: listingId,
    p_message: 'Can I start a new enquiry?',
  });
  assert.ok(deniedConversation.error, 'new enquiries close after unavailability');

  const invalidations = success(await root.from('tour_cache_invalidations')
    .select('reason').eq('parent_id', listingId), 'read parent invalidations');
  assert.ok(invalidations.some((row) => row.reason === 'listing_status_sold'));

  console.log(`Tours ${smokeTarget.label} listing integration smoke passed: card summaries, signed playback identity, saved unavailable media, chat context, enquiry closure and cache invalidation.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  if (imagePath) {
    try { await root.storage.from('listing-images').remove([imagePath]); } catch { /* best effort */ }
  }
  await cleanupTourFixtures({ listingId, users: [owner, buyer, outsider, admin].filter(Boolean) });
}
