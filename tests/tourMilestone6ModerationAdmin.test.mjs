import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeTourAdminDecision,
  normalizeTourAdminQueueRequest,
  normalizeTourReport,
} from '../src/services/listingTourContracts.js';
import { normalizeAdminReportsRequest } from '../src/services/adminContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  priorModeration,
  edgeFunction,
  supabaseConfig,
  repository,
  service,
  contracts,
  reportDialog,
  reportAction,
  mediaViewer,
  adminQueue,
  adminReports,
  adminAudit,
  packageJson,
  smoke,
] = await Promise.all([
  read('supabase/migrations/0039_v1_tour_reporting_and_admin.sql'),
  read('supabase/rollback/0039_v1_tour_reporting_and_admin.rollback.sql'),
  read('supabase/migrations/0034_v1_tour_moderation_and_reports.sql'),
  read('supabase/functions/tour-admin-review-access/index.ts'),
  read('supabase/config.toml'),
  read('src/repositories/listingToursRepository.js'),
  read('src/services/listingToursService.js'),
  read('src/services/listingTourContracts.js'),
  read('src/components/tours/TourReportDialog.jsx'),
  read('src/components/tours/TourReportAction.jsx'),
  read('src/components/listings/ListingMediaViewer.jsx'),
  read('src/components/admin/AdminTourQueue.jsx'),
  read('src/pages/admin/AdminReports.jsx'),
  read('src/pages/admin/AdminAuditLog.jsx'),
  read('package.json'),
  read('scripts/tours-moderation-admin-smoke-local.mjs'),
]);

const TOUR_ID = '11111111-1111-4111-8111-111111111111';

test('Tour reports have explicit durable target identity and preserve parent context', () => {
  assert.match(migration, /add column if not exists target_id uuid/);
  assert.match(migration, /when target_type = 'tour' then coalesce\(tour_id, id\)/);
  assert.match(migration, /report UUID is the only collision-free/);
  assert.match(migration, /create or replace function public\.set_report_target_identity/);
  assert.match(migration, /new\.target_type = 'tour'[\s\S]*new\.target_id is not null[\s\S]*new\.tour_id is null/);
  assert.match(migration, /new\.target_type := 'tour'/);
  assert.match(migration, /new\.target_id := new\.tour_id/);
  assert.match(migration, /reports_target_identity_consistency/);
  assert.match(migration, /target_type = 'tour'[\s\S]*target_id = tour_id/);
  assert.match(priorModeration, /listing_id, service_id, tour_id, target_type/);
  assert.match(priorModeration, /Tour report rate exceeded/);
  assert.match(priorModeration, /this Tour is already reported by the user/);
});

test('generic report decisions can never delete a Tour parent listing', () => {
  const tourBranch = migration
    .replace(/\r\n/g, '\n')
    .match(/if target_type = 'tour' then[\s\S]*?return after_row;\n    end if;/)?.[0] || '';
  assert.match(tourBranch, /admin_reject_tour\(target_tour/);
  assert.match(tourBranch, /admin_approve_tour\(target_tour/);
  assert.doesNotMatch(tourBranch, /delete from public\.listings|delete from public\.services/);
  assert.match(migration, /Only the Tour|canonical parent/i);
  assert.match(smoke, /parent listing survives Tour removal/);
});

test('admin report queue exposes Tour identity and exact video reasons', () => {
  assert.match(migration, /p_kind not in \('all', 'property', 'vehicle', 'machinery', 'service', 'tour', 'message'\)/);
  for (const field of ['target_type text', 'target_id uuid', 'tour_id uuid', 'tour_status text', 'tour_moderation_status text']) {
    assert.match(migration, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(migration, /coalesce\(r\.tour_reason, r\.reason::text\)/);
  assert.match(adminReports, /<SelectItem value="tour">Tours<\/SelectItem>/);
  assert.match(adminReports, /Remove reported Tour/);
  assert.match(adminReports, /Only the Tour video will be removed/);
});

test('public users can report the video from catalogue and detail playback', () => {
  assert.match(reportDialog, /unrelated_video/);
  assert.match(reportDialog, /misleading_representation/);
  assert.match(reportDialog, /stolen_content/);
  assert.match(reportDialog, /unsafe_content/);
  assert.match(reportDialog, /inappropriate_content/);
  assert.match(reportDialog, /prohibited_watermark/);
  assert.match(reportDialog, /suspected_fraud/);
  assert.match(reportDialog, /duplicate_content/);
  assert.match(reportDialog, /reportListingTour/);
  assert.match(reportAction, /GuestPromptSheet/);
  assert.match(reportAction, /Report Peek/);
  assert.match(mediaViewer, /TourReportAction/);
  assert.match(mediaViewer, /setTourReported\(true\)/);
});

test('admin review media uses a short-lived signed boundary and never exposes source files', () => {
  assert.match(migration, /create or replace function public\.admin_tour_review_metadata/);
  assert.match(migration, /if not public\.is_admin\(\)/);
  assert.match(edgeFunction, /admin_tour_review_metadata/);
  assert.match(edgeFunction, /tour-playback/);
  assert.match(edgeFunction, /tour-thumbnails/);
  assert.match(edgeFunction, /signedPlaybackLifetimeSeconds/);
  assert.match(supabaseConfig, /\[functions\.tour-admin-review-access\][\s\S]*verify_jwt = true/);
  assert.doesNotMatch(edgeFunction, /source_storage_path|tour-sources/);
  assert.match(repository, /tour-admin-review-access/);
  assert.match(service, /getAdminTourReviewAccess/);
  assert.match(service, /featureFlags\.tours && !featureFlags\.toursPreview/);
  assert.match(adminReports, /featureFlags\.tours \|\| featureFlags\.toursPreview/);
  assert.match(smoke, /non-admin cannot obtain moderation media/);
});

test('founder queue covers pending, reported, failed, rejected and approved Tours', () => {
  for (const status of ['pending', 'reported', 'failed', 'rejected', 'approved', 'all']) {
    assert.match(adminQueue, new RegExp(`value="${status}"`));
  }
  assert.match(adminQueue, /Approve/);
  assert.match(adminQueue, /Reject/);
  assert.match(adminQueue, /Restore/);
  assert.match(adminQueue, /Remove Tour/);
  assert.match(adminQueue, /Processing failure/);
  assert.match(adminQueue, /View parent|Parent/);
  assert.match(migration, /owner_rejected_tour_count bigint/);
  assert.match(migration, /latest_report_id uuid/);
});

test('repeat-offender suspension remains manual, reasoned and audited', () => {
  assert.match(adminQueue, /setAdminUserStatus/);
  assert.match(adminQueue, /status: 'suspended'/);
  assert.match(adminQueue, /Account suspension remains a manual, reasoned admin action/);
  assert.match(migration, /record_admin_action\([\s\S]*'tour_report\.'/);
  assert.match(priorModeration, /record_admin_action\([\s\S]*'tour_approved'/);
  assert.match(priorModeration, /record_admin_action\([\s\S]*'tour_rejected'/);
  assert.match(adminAudit, /value="tour_report"/);
  assert.match(adminAudit, /value="listing_tour"/);
  assert.match(smoke, /user\.status_changed/);
});

test('moderation remains deterministic and contains no external AI dependency', () => {
  assert.match(migration, /manual Tour reporting|manual/i);
  assert.doesNotMatch(`${migration}\n${edgeFunction}\n${adminQueue}`, /openai|anthropic|gemini|computer vision|ai moderation/i);
  assert.match(priorModeration, /No external AI moderation is introduced/);
});

test('rollback disables the new queue surface without deleting marketplace data', () => {
  assert.match(rollback, /drop function if exists public\.admin_tour_review_metadata/);
  assert.match(rollback, /Restore the Milestone 2 queue signature/);
  assert.doesNotMatch(rollback, /drop table|delete from public\.listing_tours|delete from public\.listings|delete from public\.services/);
  assert.match(rollback, /would reintroduce the parent-[\s\S]*listing deletion defect/);
});

test('executable Tour moderation contracts reject malformed admin and report inputs', () => {
  assert.deepEqual(normalizeTourAdminQueueRequest({ query: ' seller ', status: 'reported', limit: 20, cursor: { reportedPriority: 0, failedPriority: 1, at: '2026-07-27T08:00:00Z', id: TOUR_ID } }), {
    query: 'seller', status: 'reported', limit: 20, cursor: { reportedPriority: 0, failedPriority: 1, at: '2026-07-27T08:00:00.000Z', id: TOUR_ID },
  });
  assert.throws(() => normalizeTourAdminQueueRequest({ status: 'viral' }), /status is invalid/);
  assert.throws(() => normalizeTourAdminQueueRequest({ limit: 101 }), /limit is invalid/);
  assert.deepEqual(normalizeTourAdminDecision(TOUR_ID, '  Manual policy review  '), {
    tourId: TOUR_ID, reason: 'Manual policy review',
  });
  assert.throws(() => normalizeTourAdminDecision(TOUR_ID, 'x'), /admin reason/);
  assert.equal(normalizeTourReport({ tourId: TOUR_ID, reason: 'suspected_fraud', description: ' Evidence ' }).description, 'Evidence');
  assert.throws(() => normalizeTourReport({ tourId: TOUR_ID, reason: 'spam' }), /reason is invalid/);
  assert.equal(normalizeAdminReportsRequest({ kind: 'tour' }).kind, 'tour');
});

test('package exposes local and guarded hosted Tour moderation smokes', () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:tours-moderation-local'], 'node ./scripts/tours-moderation-admin-smoke-local.mjs');
  // The hosted script must route through the guard: the smoke scripts default
  // to the local stack, so an unguarded hosted entry silently verifies localhost.
  assert.equal(
    pkg.scripts['test:tours-moderation-hosted'],
    'node ./scripts/run-hosted-smoke.mjs ./scripts/tours-moderation-admin-smoke-local.mjs',
  );
  assert.match(smoke, /Tour report enters the existing report queue/);
  assert.match(smoke, /Tour-only removal/);
  assert.match(smoke, /repeat-offender context/);
});
