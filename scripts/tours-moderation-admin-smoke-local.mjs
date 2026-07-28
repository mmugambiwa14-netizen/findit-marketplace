import assert from 'node:assert/strict';
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
  success,
} from './lib/tour-smoke-fixtures.mjs';

let owner;
let admin;
let reporter;
let listingId;

async function createApprovedTour(label) {
  const upload = await createTourUpload({
    owner,
    listingId,
    bytes: Buffer.from(`findit-moderation-${label}`),
    durationSeconds: 20,
  });
  const claim = await claimTourProcessing(upload.tourId);
  await finalizeTourProcessing(claim, {
    playbackBytes: Buffer.from(`playback-${label}`),
    thumbnailBytes: Buffer.from(`thumbnail-${label}`),
    durationSeconds: 20,
  });
  success(await admin.browser.rpc('admin_approve_tour', {
    p_tour_id: upload.tourId,
    p_reason: `Approve ${label} moderation fixture`,
  }), `approve ${label} Tour`);
  return upload.tourId;
}

try {
  owner = await createSmokeUser('tour-moderation-owner');
  admin = await createSmokeUser('tour-moderation-admin', 'admin');
  reporter = await createSmokeUser('tour-moderation-reporter');
  listingId = await createAvailableListing(owner.userId, 'Tour moderation parent must survive');
  await setToursDatabaseEnabled(true);

  const removedTourId = await createApprovedTour('remove');
  const reportId = success(await reporter.browser.rpc('report_tour', {
    p_tour_id: removedTourId,
    p_reason: 'misleading_representation',
    p_description: 'The video does not match the canonical listing.',
  }), 'report Tour for removal');

  const reportRows = success(await admin.browser.rpc('admin_report_rows_page', {
    p_query: '', p_status: 'pending', p_kind: 'tour', p_limit: 25, p_cursor_at: null, p_cursor_id: null,
  }), 'read Tour report queue');
  const report = reportRows.find((row) => row.report_id === reportId);
  assert.ok(report, 'Tour report enters the existing report queue');
  assert.equal(report.target_type, 'tour');
  assert.equal(report.target_id, removedTourId);
  assert.equal(report.listing_id, listingId, 'Tour report preserves canonical parent relationship');
  assert.equal(report.reason, 'misleading_representation');

  const adminMedia = await invokeFunction('tour-admin-review-access', {
    accessToken: admin.session.access_token,
    body: { tourId: removedTourId },
  });
  assert.equal(adminMedia.response.status, 200, `admin media access failed: ${JSON.stringify(adminMedia.body)}`);
  assert.ok(adminMedia.body.playbackUrl, 'admin can review reported playback through a short-lived URL');
  assert.ok(adminMedia.body.thumbnailUrl, 'admin can review the reported thumbnail');
  assert.equal('sourceStoragePath' in adminMedia.body, false, 'review response never exposes source paths');

  const forbiddenMedia = await invokeFunction('tour-admin-review-access', {
    accessToken: reporter.session.access_token,
    body: { tourId: removedTourId },
  });
  assert.equal(forbiddenMedia.response.status, 403, 'non-admin cannot obtain moderation media');

  success(await admin.browser.rpc('admin_review_report', {
    p_report_id: reportId,
    p_status: 'actioned',
    p_notes: 'Remove the misleading Tour while preserving its parent listing.',
  }), 'action Tour report');
  assert.equal(success(await root.from('listing_tours').select('status,moderation_status').eq('id', removedTourId).single(), 'read removed Tour').moderation_status, 'rejected');
  assert.ok(success(await root.from('listings').select('id').eq('id', listingId).single(), 'parent listing survives Tour removal').id);
  assert.equal(success(await root.from('reports').select('status').eq('id', reportId).single(), 'read actioned report').status, 'actioned');

  const restoredTourId = await createApprovedTour('restore');
  const restoreReportId = success(await reporter.browser.rpc('report_tour', {
    p_tour_id: restoredTourId,
    p_reason: 'duplicate_content',
    p_description: 'False-positive fixture used to verify manual restoration.',
  }), 'report Tour for restoration');
  success(await admin.browser.rpc('admin_review_report', {
    p_report_id: restoreReportId,
    p_status: 'dismissed',
    p_notes: 'The report is unsupported and the Tour remains eligible.',
  }), 'dismiss and restore Tour report');
  const restored = success(await root.from('listing_tours').select('status,moderation_status,published_at').eq('id', restoredTourId).single(), 'read restored Tour');
  assert.equal(restored.status, 'ready');
  assert.equal(restored.moderation_status, 'approved');
  assert.ok(restored.published_at, 'dismissal restores publication for an eligible Tour');

  const queueRows = success(await admin.browser.rpc('admin_tour_queue_page', {
    p_query: owner.email,
    p_status: 'all',
    p_limit: 25,
    p_cursor_reported_priority: null, p_cursor_failed_priority: null, p_cursor_at: null, p_cursor_id: null,
  }), 'read extended Tour moderation queue');
  const restoredQueue = queueRows.find((row) => row.tour_id === restoredTourId);
  assert.ok(restoredQueue, 'extended queue supports owner search');
  assert.equal(restoredQueue.parent_path, `/car/${listingId}`);
  assert.ok(Number(restoredQueue.owner_rejected_tour_count) >= 1, 'queue exposes repeat-offender context');

  success(await admin.browser.rpc('admin_set_user_status', {
    p_user_id: owner.userId,
    p_status: 'suspended',
    p_reason: 'Repeated rejected Tour moderation fixture.',
    p_ban_until: null,
  }), 'suspend repeat Tour offender');
  assert.equal(success(await root.from('users').select('status').eq('id', owner.userId).single(), 'read suspended owner').status, 'suspended');

  const audits = success(await root.from('audit_logs')
    .select('action_performed,target_record_type')
    .in('target_record_type', ['listing_tour', 'tour_report', 'user'])
    .order('created_at', { ascending: false })
    .limit(50), 'read Tour moderation audits');
  assert.ok(audits.some((row) => row.action_performed === 'tour_report.actioned'));
  assert.ok(audits.some((row) => row.action_performed === 'tour_report.dismissed'));
  assert.ok(audits.some((row) => row.action_performed === 'user.status_changed'));

  console.log('Tours moderation smoke passed: report identity, signed admin review, Tour-only removal, restoration, repeat-offender context, suspension and audit coverage.');
} finally {
  try { await setToursDatabaseEnabled(false); } catch { /* best effort */ }
  await cleanupTourFixtures({ listingId, users: [owner, admin, reporter].filter(Boolean) });
}
