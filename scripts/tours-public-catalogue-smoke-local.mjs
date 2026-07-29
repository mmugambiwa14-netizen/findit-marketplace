import assert from 'node:assert/strict';
import {
  claimTourProcessing,
  cleanupTourFixtures,
  createAvailableListing,
  createServiceWithStatus,
  createSmokeUser,
  createTourUpload,
  finalizeTourProcessing,
  invokeFunction,
  root,
  setToursDatabaseEnabled,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

const owners = [];
let admin;
const listingIds = [];
const listingOwners = new Map();
let serviceId;

async function publish(parent) {
  const upload = await createTourUpload({ ...parent, bytes: Buffer.from(`findit-feed-${parent.listingId ?? parent.serviceId}`), durationSeconds: 37 });
  const claim = await claimTourProcessing(upload.tourId);
  await finalizeTourProcessing(claim, { durationSeconds: 37 });
  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: upload.tourId,
    p_reason: 'Approve public catalogue smoke fixture',
  }), 'approve public catalogue Tour');
  return upload.tourId;
}

try {
  admin = await createSmokeUser('tour-feed-admin', 'admin');
  await setToursDatabaseEnabled(true);

  const fixtureCount = Math.min(48, Math.max(12, Number(process.env.FINDIT_TOUR_FEED_FIXTURE_COUNT) || 18));
  const ownerCount = Math.ceil((fixtureCount + 1) / 9);
  for (let index = 0; index < ownerCount; index += 1) {
    owners.push(await createSmokeUser(`tour-feed-owner-${index + 1}`));
  }
  const titles = Array.from({ length: fixtureCount }, (_, index) => {
    if (index === 0) return 'Newest cursor car';
    if (index === 1) return 'Middle cursor car';
    if (index === 2) return 'Literal %_ cursor car';
    return `Cursor volume car ${String(index + 1).padStart(2, '0')}`;
  });
  for (let index = 0; index < titles.length; index += 1) {
    const owner = owners[index % owners.length];
    const listingId = await createAvailableListing(owner.userId, titles[index]);
    listingIds.push(listingId);
    listingOwners.set(listingId, owner);
  }

  const serviceOwner = owners.at(-1);
  serviceId = await createServiceWithStatus(serviceOwner.userId, 'Mobile mechanic Tour', 'active', 'mechanic');
  success(await root.from('services').update({ location_name: 'Harare' }).eq('id', serviceId), 'set service location');

  const tourIds = [];
  for (const listingId of listingIds) {
    tourIds.push(await publish({ owner: listingOwners.get(listingId), listingId }));
  }
  const serviceTourId = await publish({ owner: serviceOwner, serviceId });

  // Use deterministic descending timestamps and repeated timestamps so the
  // UUID tie-breaker is exercised across multiple cursor pages.
  const baseTime = Date.parse('2026-07-27T10:30:00Z');
  for (let index = 0; index < tourIds.length; index += 1) {
    const minuteOffset = index === 0 ? 0 : Math.floor((index - 1) / 3) + 1;
    const publishedAt = new Date(baseTime - minuteOffset * 60_000).toISOString();
    success(await root.from('listing_tours').update({ published_at: publishedAt }).eq('id', tourIds[index]), 'set deterministic publication time');
  }
  success(await root.from('listing_tours').update({ published_at: '2026-07-27T09:00:00Z' }).eq('id', serviceTourId), 'set service publication time');

  const allItems = [];
  let cursor = null;
  let pageCount = 0;
  do {
    const page = await invokeFunction('tour-feed', { body: { category: 'all', query: '', location: '', limit: 4, cursor } });
    assert.equal(page.response.status, 200, `Tour feed page ${pageCount + 1} failed: ${JSON.stringify(page.body)}`);
    assert.ok(page.body.items.length > 0 && page.body.items.length <= 4, 'each page remains bounded');
    for (const item of page.body.items) {
      assert.ok(item.thumbnailUrl, 'feed signs Tour thumbnails');
      assert.equal('playbackUrl' in item, false, 'feed does not expose playback URLs');
    }
    allItems.push(...page.body.items);
    cursor = page.body.nextCursor;
    pageCount += 1;
    assert.ok(pageCount <= 20, 'cursor pagination terminates');
  } while (cursor);

  const expectedTotal = fixtureCount + 1;
  assert.equal(allItems.length, expectedTotal, 'all eligible fixture Tours are returned across pages');
  assert.equal(new Set(allItems.map((item) => item.tourId)).size, expectedTotal, 'no duplicate Tours across cursor pages');
  assert.ok(pageCount >= 4, 'catalogue smoke crosses several keyset pages');
  assert.equal(allItems[0].title, 'Newest cursor car');

  for (let index = 1; index < allItems.length; index += 1) {
    const previous = allItems[index - 1];
    const current = allItems[index];
    const previousKey = `${previous.publishedAt}|${previous.tourId}`;
    const currentKey = `${current.publishedAt}|${current.tourId}`;
    assert.ok(previousKey > currentKey, 'feed order is strictly descending by published_at and Tour id');
  }

  const serviceFeed = await invokeFunction('tour-feed', { body: { category: 'service', query: '', location: 'Harare', limit: 8, cursor: null } });
  assert.equal(serviceFeed.response.status, 200, `service category filter failed: ${JSON.stringify(serviceFeed.body)}`);
  assert.deepEqual(serviceFeed.body.items.map((item) => item.tourId), [serviceTourId], 'service category filter returns only service Tours');

  const searchFeed = await invokeFunction('tour-feed', { body: { category: 'car', query: 'Middle cursor', location: '', limit: 8, cursor: null } });
  assert.equal(searchFeed.response.status, 200);
  assert.deepEqual(searchFeed.body.items.map((item) => item.title), ['Middle cursor car']);

  const literalSearch = await invokeFunction('tour-feed', { body: { category: 'car', query: '%_', location: '', limit: 8, cursor: null } });
  assert.equal(literalSearch.response.status, 200);
  assert.deepEqual(literalSearch.body.items.map((item) => item.title), ['Literal %_ cursor car'], 'wildcard characters are treated literally');

  success(await root.from('listings').update({ status: 'sold' }).eq('id', listingIds[0]), 'mark newest fixture unavailable');
  const afterUnavailable = await invokeFunction('tour-feed', { body: { category: 'car', query: 'Newest cursor', location: '', limit: 8, cursor: null } });
  assert.equal(afterUnavailable.response.status, 200);
  assert.equal(afterUnavailable.body.items.length, 0, 'unavailable listing leaves public Tours catalogue');

  console.log(`Tours ${smokeTarget.label} public catalogue smoke passed: ${expectedTotal} fixtures across ${pageCount} keyset pages, strict ordering, no duplicates, literal search, service filter, signed thumbnails and unavailable exclusion.`);
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  for (const listingId of listingIds) await cleanupTourFixtures({ listingId });
  if (serviceId) await cleanupTourFixtures({ serviceId });
  await cleanupTourFixtures({ users: [...owners, admin].filter(Boolean) });
}
