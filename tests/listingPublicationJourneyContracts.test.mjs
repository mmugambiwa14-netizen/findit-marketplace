import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('listing creation preserves a resumable local draft before publication', async () => {
  const page = await read('src/pages/CreateListing.jsx');
  assert.match(page, /usePersistentFormDraft/);
  assert.match(page, /findit_listing_draft_v2_/);
  assert.match(page, /onRestore: restoreDraft/);
  assert.match(page, /beforeunload/);
  assert.match(page, /Draft saved on this device/);
});

test('listing images use private bounded single-use upload intents', async () => {
  const service = await read('src/services/listingCreationService.js');
  const repository = await read('src/repositories/listingCreationRepository.js');
  const base = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  assert.match(service, /MAX_UPLOAD_BYTES = 5 \* 1024 \* 1024/);
  assert.match(service, /convertPhoneImageToJpeg/);
  assert.match(repository, /listing-image-upload/);
  assert.match(base, /listing_upload_intents/);
  assert.match(base, /listing-images', false, 5242880/);
  assert.match(base, /state in \('validated', 'uploaded', 'attached', 'rejected'\)/);
  assert.match(base, /listing image is invalid, expired, or already attached/);
  assert.match(base, /duplicate listing image/);
});

test('submission validates business category payload location contact media and details atomically', async () => {
  const service = await read('src/services/listingCreationService.js');
  const repository = await read('src/repositories/listingCreationRepository.js');
  const base = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  assert.match(service, /can_publish_in_category/);
  assert.match(service, /normalizeListingSubmission/);
  assert.match(repository, /create_v1_listing_submission/);
  assert.match(base, /active listing category not found/);
  assert.match(base, /active Zimbabwe location not found/);
  assert.match(base, /media_count not between 1 and 20/);
  assert.match(base, /insert into public\.property_details/);
  assert.match(base, /insert into public\.car_details/);
  assert.match(base, /insert into public\.machinery_details/);
  assert.match(base, /idx_listings_submission_key/);
});

test('validated listings publish immediately without listing moderation', async () => {
  const migration = await read('supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql');
  assert.match(migration, /auto_publish_validated_mvp_listing/);
  assert.match(migration, /if new\.status = 'pending_review'/);
  assert.match(migration, /new\.status := 'available'/);
  assert.match(migration, /next_status := 'available'/);
  assert.match(migration, /no human listing review/i);
  assert.doesNotMatch(migration, /listing_approved/);
  assert.doesNotMatch(migration, /admin_moderate_marketplace_item/);
});

test('public cards details search and seller inventory use available listing boundaries', async () => {
  const publicService = await read('src/services/publicListingsService.js');
  const publicRepository = await read('src/repositories/publicListingsRepository.js');
  const app = await read('src/App.jsx');
  assert.match(publicService, /hydrateListingImages/);
  assert.match(publicRepository, /PUBLIC_LISTING_SELECT/);
  assert.match(publicRepository, /\.in\('status', \['available', 'under_offer'\]\)/);
  assert.match(publicRepository, /public_listing_search_page/);
  assert.match(app, /property\/\:id|property\/:id/);
  assert.match(app, /car\/\:id|car\/:id/);
  assert.match(app, /machinery\/\:id|machinery\/:id/);
});

test('owner journey supports edit pause resume relist unavailable and permanent delete', async () => {
  const page = await read('src/pages/MyListings.jsx');
  const creation = await read('src/services/listingCreationService.js');
  const owner = await read('src/services/ownerListingsService.js');
  const migration = await read('supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql');
  assert.match(page, /EditListingDialog/);
  assert.match(page, /action: 'pause'/);
  assert.match(page, /action: 'resume'/);
  assert.match(page, /action: "submit"/);
  assert.match(page, /action: 'unavailable'/);
  assert.match(page, /deleteOwnerListing/);
  // The RPC call lives in the repository layer, not the service, which is this
  // codebase's architecture: repositories own the supabase calls and services
  // orchestrate them. Asserting the raw RPC name in the service was testing the
  // wrong layer and broke when the call was correctly moved. Assert the real
  // wiring across both layers instead, which is strictly stronger than the
  // single string it replaces: the service must route through the wrapper, and
  // the wrapper must reach the guarded owner_transition_listing RPC.
  const repository = await read('src/repositories/listingCreationRepository.js');
  assert.match(creation, /transitionOwnerListing/);
  assert.match(repository, /supabase\.rpc\('owner_transition_listing'/);
  assert.match(owner, /deleteOwnerListingRow/);
  assert.match(migration, /p_action not in \('submit', 'pause', 'resume', 'unavailable'\)/);
  assert.match(migration, /p_action = 'submit'/);
  assert.match(migration, /next_status := 'available'/);
});

test('valid live edits remain published while managed fields remain protected', async () => {
  const migration = await read('supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql');
  const owner = await read('src/services/ownerListingsService.js');
  assert.match(migration, /protect_listing_managed_fields/);
  assert.match(migration, /listing-managed fields require a trusted operation/);
  assert.doesNotMatch(migration, /new\.status := 'pending_review'/);
  assert.match(owner, /replaceListingMedia/);
  assert.match(owner, /Promise\.allSettled\(removedPaths/);
  assert.match(owner, /partial: true/);
});

test('successful Peeks are automatically published after processing validation', async () => {
  const peek = await read('supabase/migrations/20260804193300_auto_publish_successful_peeks.sql');
  assert.match(peek, /auto_publish_ready_tour/);
  assert.match(peek, /processing_validation_passed/);
  assert.match(peek, /promote_approved_tour/);
  assert.match(peek, /listing_tours_auto_publish_ready/);
});

test('listing journey has executable database and hosted certification assets', async () => {
  const pgTap = await read('supabase/tests/v1_listing_creation_and_media.sql');
  const runner = await read('scripts/certify-listing-publication-journey.mjs');
  const rollback = await read('supabase/rollback/20260807030000_remove_listing_content_review_from_mvp.rollback.sql');
  assert.match(pgTap, /publish immediately without human review/);
  assert.match(pgTap, /pause a live listing/);
  assert.match(pgTap, /relist an unavailable listing/);
  assert.match(pgTap, /permanently delete/);
  assert.match(runner, /listingPublicationJourneyContracts/);
  assert.match(rollback, /Restore the pre-MVP owner transition contract/);
});
