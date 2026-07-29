import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createAvailableListing,
  createSmokeUser,
  root,
  smokeTarget,
  success,
} from './lib/tour-smoke-fixtures.mjs';

const users = [];
let listingId;

try {
  const owner = await createSmokeUser('notification-scale-owner');
  const saverA = await createSmokeUser('notification-scale-saver-a');
  const saverB = await createSmokeUser('notification-scale-saver-b');
  const saverC = await createSmokeUser('notification-scale-saver-c');
  const stranger = await createSmokeUser('notification-scale-stranger');
  users.push(owner, saverA, saverB, saverC, stranger);

  listingId = await createAvailableListing(owner.userId, 'Notification fan-out scale listing');
  success(await root.from('saved_listings').insert([
    { user_id: saverA.userId, listing_id: listingId },
    { user_id: saverB.userId, listing_id: listingId },
    { user_id: saverC.userId, listing_id: listingId },
  ]), 'create saved-listing recipients');

  const baseTime = Date.parse('2026-07-27T12:00:00Z');
  const deepRows = Array.from({ length: 121 }, (_, index) => ({
    id: crypto.randomUUID(),
    user_id: saverA.userId,
    title: `Notification cursor ${String(index + 1).padStart(3, '0')}`,
    message: 'Bounded notification cursor fixture.',
    type: 'system',
    link: '/profile',
    event_type: 'account_status',
    source_key: `notification-scale:${index + 1}`,
    is_read: false,
    created_at: new Date(baseTime - Math.floor(index / 3) * 1000).toISOString(),
  }));
  success(await root.from('app_alerts').insert(deepRows), 'create deep notification cursor fixtures');

  const seen = new Set();
  let cursorAt = null;
  let cursorId = null;
  for (;;) {
    const rows = success(await saverA.browser.rpc('notification_rows_page', {
      p_event_type: 'account_status',
      p_unread_only: false,
      p_cursor_at: cursorAt,
      p_cursor_id: cursorId,
      p_limit: 25,
    }), 'page notification cursor fixtures');
    const page = rows.slice(0, 25);
    for (const row of page) {
      assert.equal(seen.has(row.notification_id), false, 'notification pages must contain no duplicates');
      seen.add(row.notification_id);
    }
    if (rows.length <= 25) break;
    const last = page.at(-1);
    cursorAt = last.created_at;
    cursorId = last.notification_id;
  }
  assert.equal(seen.size, 121, 'notification keyset traversal must contain no duplicates or skips');

  const strangerRows = success(await stranger.browser.rpc('notification_rows_page', {
    p_event_type: 'all', p_unread_only: false, p_cursor_at: null, p_cursor_id: null, p_limit: 25,
  }), 'verify notification owner isolation');
  assert.equal(strangerRows.length, 0, 'strangers cannot read another user notification page');

  const baselineHealth = success(
    await root.rpc('evaluate_notification_fanout_alerts', {}),
    'capture notification fan-out health baseline',
  );
  success(await root.from('listings').update({ status: 'sold' }).eq('id', listingId), 'queue saved-listing unavailability');
  const hiddenJobs = await saverA.browser.from('essential_notification_fanout_jobs').select('id').limit(1);
  assert.ok(hiddenJobs.error, 'ordinary users cannot read fan-out jobs');

  const fixtureJob = success(
    await root
      .from('essential_notification_fanout_jobs')
      .select('id')
      .eq('listing_id', listingId)
      .eq('event_type', 'saved_listing_unavailable')
      .single(),
    'locate fixture notification fan-out job',
  );
  let completed = false;
  let batches = 0;
  while (!completed && batches < 5) {
    success(
      await root
        .from('essential_notification_fanout_jobs')
        .update({ next_attempt_at: '-infinity' })
        .eq('id', fixtureJob.id)
        .eq('state', 'pending'),
      'prioritize only the fixture fan-out job',
    );
    const claims = success(await root.rpc('claim_notification_fanout_jobs', {
      p_limit: 1, p_lease_seconds: 120,
    }), 'claim notification fan-out job');
    assert.equal(claims.length, 1, 'one due fan-out job must be claimable');
    assert.equal(claims[0].job_id, fixtureJob.id, 'the bounded claim must select the fixture job');
    const result = success(await root.rpc('process_notification_fanout_job', {
      p_job_id: claims[0].job_id,
      p_claim_token: claims[0].claim_token,
      p_recipient_limit: 2,
    }), 'process bounded notification fan-out page');
    batches += 1;
    completed = result.complete === true;
  }
  assert.equal(completed, true, 'saved-listing fan-out must complete through bounded recipient pages');
  assert.equal(batches, 2, 'three recipients with a limit of two require exactly two pages');

  for (const saver of [saverA, saverB, saverC]) {
    const rows = success(await saver.browser.rpc('notification_rows_page', {
      p_event_type: 'saved_listing_unavailable', p_unread_only: false,
      p_cursor_at: null, p_cursor_id: null, p_limit: 10,
    }), 'load saved-listing unavailable notification');
    assert.equal(rows.length, 1, 'each saved user receives exactly one unavailable notification');
    assert.equal(rows[0].link, '/saved');
  }

  const health = success(await root.rpc('evaluate_notification_fanout_alerts', {}), 'evaluate notification fan-out health');
  for (const field of ['pending', 'claimed', 'dead_lettered', 'stale_claims']) {
    assert.equal(
      Number(health[field]),
      Number(baselineHealth[field]),
      `fixture cleanup must restore the shared ${field} fan-out health count`,
    );
  }

  console.log(`Notification scale smoke (${smokeTarget.label}): PASS`);
  console.log('Verified 121-row keyset traversal, owner isolation, private queue access, and bounded three-recipient fan-out.');
} finally {
  if (listingId) {
    await root.from('essential_notification_fanout_jobs').delete().eq('listing_id', listingId);
    await root.from('saved_listings').delete().eq('listing_id', listingId);
    await root.from('listings').delete().eq('id', listingId);
  }
  for (const user of users) {
    if (user.userId) await root.from('app_alerts').delete().eq('user_id', user.userId);
    try { await user.browser.auth.signOut(); } catch { /* best effort */ }
    if (user.userId) {
      try { await root.auth.admin.deleteUser(user.userId); } catch { /* best effort */ }
    }
  }
}
