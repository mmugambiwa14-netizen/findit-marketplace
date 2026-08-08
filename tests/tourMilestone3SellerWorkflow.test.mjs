import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  creation,
  mediaStep,
  reviewStep,
  successStep,
  editListing,
  createService,
  editService,
  uploader,
  management,
  service,
  serviceTaxonomy,
  packageJson,
  sellerSmoke,
  smokeFixtures,
  databaseTests,
] = await Promise.all([
  read('supabase/migrations/0036_v1_seller_tour_workflow.sql'),
  read('supabase/rollback/0036_v1_seller_tour_workflow.rollback.sql'),
  read('src/pages/CreateListing.jsx'),
  read('src/components/create-listing/ListingMediaContactStep.jsx'),
  read('src/components/create-listing/ListingReviewStep.jsx'),
  read('src/components/create-listing/PublishSuccess.jsx'),
  read('src/components/listings/EditListingDialog.jsx'),
  read('src/pages/CreateService.jsx'),
  read('src/components/services/EditServiceDialog.jsx'),
  read('src/components/tours/TourUploader.jsx'),
  read('src/components/tours/TourManagementPanel.jsx'),
  read('src/services/listingToursService.js'),
  read('supabase/migrations/20260808081100_service_specialization_taxonomy.sql'),
  read('package.json'),
  read('scripts/tours-seller-workflow-smoke-local.mjs'),
  read('scripts/lib/tour-smoke-fixtures.mjs'),
  read('supabase/tests/v1_tour_foundation.sql'),
]);

test('seller workflow migration admits normal review states without changing public eligibility', () => {
  assert.match(migration, /status in \('draft', 'pending_review', 'available', 'under_offer', 'rejected', 'expired'\)/);
  assert.match(migration, /public eligibility remains unchanged/i);
  assert.doesNotMatch(migration, /status in \([^)]*sold[^)]*\)/);
  assert.doesNotMatch(migration, /status in \([^)]*unavailable[^)]*\)/);
  assert.match(rollback, /status in \('draft', 'available', 'under_offer'\)/);
  assert.match(databaseTests, /pending-review listing can authorize/);
  assert.match(databaseTests, /active non-legal service can authorize/);
  assert.match(databaseTests, /unavailable service remains closed/);
  assert.match(databaseTests, /legal services remain excluded/);
  assert.match(databaseTests, /expired authorization renews the same Tour identity/);
  assert.match(databaseTests, /exact object accepted before expiry can be confirmed after/);
  assert.match(databaseTests, /expired authorization cannot renew after its parent becomes unavailable/);
});

test('listing creation stages an optional Tour and uploads only after canonical listing creation', () => {
  assert.match(mediaStep, /<TourUploader/);
  assert.match(mediaStep, /tourDraft/);
  const submitPosition = creation.indexOf('await submitListing');
  const tourPosition = creation.indexOf('await uploadListingTour');
  assert.ok(submitPosition >= 0 && tourPosition > submitPosition, 'Tour upload follows canonical listing creation');
  assert.match(creation, /parentId: result\.id/);
  assert.match(creation, /status: 'error'/);
  assert.match(creation, /setSubmittedListing\(/);
  assert.match(reviewStep, /A Peek failure will not remove or block the listing/);
  assert.match(successStep, /The listing is live, but the Peek upload did not finish/);
  assert.match(successStep, /Resume Peek upload/);
  assert.match(successStep, /Discard unfinished Peek/);
});

test('seller can add, replace, remove and retry Tours from listing and service editing', () => {
  assert.match(editListing, /<TourManagementPanel/);
  assert.match(editListing, /parentType="listing"/);
  assert.match(editService, /<TourManagementPanel/);
  assert.match(editService, /parentType="service"/);
  assert.match(management, /removeListingTour/);
  assert.match(management, /retryListingTour/);
  assert.match(management, /current public Peek remains visible until the replacement is active/i);
  assert.match(management, /Cancel this version/);
  assert.match(management, /const newestAfterCurrent/);
  assert.match(management, /const latestIssue/);
  assert.match(management, /newestAfterCurrent\.moderation_status === 'rejected'/);
  assert.match(management, /const rejectedIssue = latestIssue\?\.moderation_status === 'rejected'/);
  assert.match(management, /const blockingPending = Boolean\(rejectedIssue\)/);
  assert.match(management, /const resumablePending = Boolean\(/);
  assert.match(management, /pending\?\.id === draft\.resumeUpload\.tourId/);
  assert.match(management, /\(!blockingPending \|\| resumablePending\)/);
  assert.match(management, /pending && !resumablePending/);
  assert.match(management, /const busy = uploadBusy \|\| mutationBusy/);
  assert.match(management, /onRemove=\{\(\) => remove\(latestIssue\)\}/);
  assert.match(management, /onUploadFailed=\{refresh\}/);
  assert.match(management, /listingTourQueryKeys\.all/);
  assert.match(management, /row\.moderation_status === 'rejected'/);

  // New service creation no longer carries a second `legal` taxonomy rule.
  // Legal is absent from the active canonical V1 taxonomy, so a seller cannot
  // choose it in CreateService. Historical legal rows remain protected by the
  // edit/Tour boundary until those records are migrated or retired.
  assert.doesNotMatch(createService, /form\.category !== ["']legal["']/);
  assert.match(createService, /const shouldUploadTour = Boolean\(tourDraft\?\.file\)/);
  assert.doesNotMatch(serviceTaxonomy, /\('legal'/);
  assert.match(editService, /service\.category !== \"legal\"/);
  assert.equal((editService.match(/service\.category !== ["\']legal["\']/g) || []).length, 1, 'legacy legal-service Tour exclusion is rendered once');
});

test('record and upload controls enforce the two-minute, direct-storage contract', () => {
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /TOUR_MAX_DURATION_SECONDS/);
  assert.match(uploader, /TOUR_MAX_SOURCE_BYTES/);
  assert.match(uploader, /normalizeTourVideoFile/);
  assert.match(uploader, /Upload Peek/);
  assert.match(uploader, /up to 2 minutes and 250 MB/);
  assert.match(uploader, />Skip<\/Button>/);
  assert.match(uploader, /onBusyChange\?\.\(true\)/);
  assert.match(mediaStep, /disabled=\{uploading \|\| tourBusy\}/);
});

test('upload interruption recovery preserves the exact signed intent and idempotency key', () => {
  assert.match(service, /resumeUpload/);
  assert.match(service, /idempotencyKey: request\.idempotencyKey/);
  assert.match(service, /return await completeUploadedTour\(intent\.intentId, callback\)/);
  assert.match(service, /throw resumableFailure/);
  assert.match(service, /uploadTourSourceObject/);
  assert.match(service, /invokeTourUploadComplete/);
  assert.match(service, /authorizationExpired/);
  assert.match(service, /recoverExpiredAuthorization/);
  assert.match(service, /idempotencyKey: resume\.idempotencyKey \|\| request\.idempotencyKey/);
  assert.match(migration, /upload_authorization_renewed/);
  assert.match(migration, /existing_intent\.tour_id/);
  assert.match(migration, /completedAfterAuthorizationExpiry/);
  assert.match(migration, /get diagnostics tour_affected = row_count/);
  assert.match(migration, /Tour upload was cancelled before confirmation/);
  assert.match(migration, /Renewal and idempotent replay must re-check the canonical parent/);
  const completionSql = migration.slice(migration.indexOf('create or replace function public.complete_tour_upload'));
  assert.doesNotMatch(completionSql, /intent\.state <> 'authorized' or intent\.expires_at <= now\(\)/);
  assert.match(rollback, /intent\.state <> 'authorized' or intent\.expires_at <= now\(\)/);
});

test('service creation uses the same parent-attached Tour boundary and preserves interruption recovery', () => {
  const serviceCreatePosition = createService.indexOf('await createService');
  const tourUploadPosition = createService.indexOf('await uploadListingTour');
  assert.ok(serviceCreatePosition >= 0 && tourUploadPosition > serviceCreatePosition);
  assert.match(createService, /parentType: 'service'/);
  assert.match(createService, /parentId: service\.id/);
  assert.match(createService, /setPublishedService\(service\)/);
  assert.match(createService, /Resume Peek upload/);
  assert.match(createService, /resumeUpload: tourDraft\.resumeUpload/);
  assert.match(createService, /Continue without Peek/);
  assert.match(createService, /removeListingTour\(tourDraft\.resumeUpload\.tourId\)/);
});

test('Milestone 3 remains a listing capability rather than a social-video identity', () => {
  const tourSurface = `${uploader}\n${management}`;
  assert.doesNotMatch(tourSurface, /followers|creator feed|public likes|comments|reaction buttons|reels/i);
});

test('package exposes an executable seller workflow smoke for listings and services', async () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:tours-seller-local'], 'node ./scripts/tours-seller-workflow-smoke-local.mjs');
  assert.match(sellerSmoke, /createListingWithStatus/);
  assert.match(sellerSmoke, /createServiceWithStatus/);
  assert.match(sellerSmoke, /legal service records cannot receive Tours/);
  assert.match(sellerSmoke, /unavailable services remain closed/);
  assert.match(sellerSmoke, /renewal preserves the Tour identity/);
  assert.match(sellerSmoke, /expired authorization cannot renew after parent unavailability/);
  assert.match(sellerSmoke, /late exact-object completion failed/);
  assert.match(smokeFixtures, /parentType = serviceId \? 'service' : 'listing'/);
  assert.match(smokeFixtures, /cleanupTourFixtures\(\{ listingId, serviceId/);
  await access(new URL('../scripts/tours-seller-workflow-smoke-local.mjs', import.meta.url));
});
