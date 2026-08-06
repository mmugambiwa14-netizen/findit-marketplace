import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('listing creation preserves a resumable browser draft before submission', async () => {
  const page = await read('src/pages/CreateListing.jsx');
  assert.match(page, /usePersistentFormDraft/);
  assert.match(page, /findit_listing_draft_v2_/);
  assert.match(page, /saveNow/);
  assert.match(page, /onRestore: restoreDraft/);
  assert.match(page, /beforeunload/);
  assert.match(page, /Draft saved on this device/);
});

test('image upload is private, bounded and attached through validated intents', async () => {
  const service = await read('src/services/listingCreationService.js');
  const repository = await read('src/repositories/listingCreationRepository.js');
  const migration = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  assert.match(service, /MAX_UPLOAD_BYTES = 5 \* 1024 \* 1024/);
  assert.match(service, /convertPhoneImageToJpeg/);
  assert.match(repository, /listing-image-upload/);
  assert.match(migration, /public\.listing_upload_intents/);
  assert.match(migration, /state in \('validated', 'uploaded', 'attached', 'rejected'\)/);
  assert.match(migration, /listing-images', false, 5242880/);
  assert.match(migration, /listing image is invalid, expired, or already attached/);
  assert.match(migration, /duplicate listing image/);
});

test('submission validates category location contact media and category-specific detail atomically', async () => {
  const service = await read('src/services/listingCreationService.js');
  const repository = await read('src/repositories/listingCreationRepository.js');
  const migration = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  assert.match(service, /can_publish_in_category/);
  assert.match(service, /normalizeListingSubmission/);
  assert.match(repository, /create_v1_listing_submission/);
  assert.match(migration, /active listing category not found/);
  assert.match(migration, /active Zimbabwe location not found/);
  assert.match(migration, /media_count not between 1 and 20/);
  assert.match(migration, /insert into public\.property_details/);
  assert.match(migration, /insert into public\.car_details/);
  assert.match(migration, /insert into public\.machinery_details/);
  assert.match(migration, /status[\s\S]*'pending_review'/);
  assert.match(migration, /idx_listings_submission_key/);
});

test('a submitted listing is not public until protected moderation publishes it', async () => {
  const migration = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  const publicRepository = await read('src/repositories/publicListingsRepository.js');
  assert.match(migration, /New product adverts are created atomically in pending_review/);
  assert.match(migration, /p_action = 'publish' and current_listing_status = 'pending_review'/);
  assert.match(migration, /set status = 'available'/);
  assert.match(migration, /listing_approved/);
  assert.match(publicRepository, /status/);
  assert.doesNotMatch(publicRepository, /pending_review[\s\S]*PUBLIC_LISTING_SELECT/);
});

test('public cards details and search use the canonical public listing boundary', async () => {
  const publicService = await read('src/services/publicListingsService.js');
  const publicRepository = await read('src/repositories/publicListingsRepository.js');
  const app = await read('src/App.jsx');
  assert.match(publicService, /hydrateListingImages/);
  assert.match(publicRepository, /PUBLIC_LISTING_SELECT/);
  assert.match(publicRepository, /available/);
  assert.match(app, /property\/\:id|property\/:id/);
  assert.match(app, /car\/\:id|car\/:id/);
  assert.match(app, /machinery\/\:id|machinery\/:id/);
});

test('owner lifecycle supports edit pause resume relist unavailable and permanent delete', async () => {
  const page = await read('src/pages/MyListings.jsx');
  const creation = await read('src/services/listingCreationService.js');
  const owner = await read('src/services/ownerListingsService.js');
  const migration = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  assert.match(page, /EditListingDialog/);
  assert.match(page, /action: 'pause'/);
  assert.match(page, /action: 'resume'/);
  assert.match(page, /action: "submit"/);
  assert.match(page, /action: 'unavailable'/);
  assert.match(page, /deleteOwnerListing/);
  assert.match(creation, /owner_transition_listing/);
  assert.match(owner, /deleteOwnerListingRow/);
  assert.match(migration, /p_action not in \('submit', 'pause', 'resume', 'unavailable'\)/);
  assert.match(migration, /p_action = 'pause'/);
  assert.match(migration, /p_action = 'resume'/);
  assert.match(migration, /p_action = 'submit'/);
  assert.match(migration, /next_status := 'pending_review'/);
});

test('editing a live listing returns it to moderation and media replacement is failure-safe', async () => {
  const migration = await read('supabase/migrations/0021_v1_listing_creation_and_media.sql');
  const owner = await read('src/services/ownerListingsService.js');
  assert.match(migration, /old\.status in \('available', 'under_offer', 'rented', 'paused'\)/);
  assert.match(migration, /new\.status := 'pending_review'/);
  assert.match(owner, /replaceListingMedia/);
  assert.match(owner, /Promise\.allSettled\(removedPaths/);
  assert.match(owner, /Listing details were saved, but image changes could not be applied/);
  assert.match(owner, /partial: true/);
});

test('existing database journey and local smoke assets remain part of certification', async () => {
  const pgTap = await read('supabase/tests/v1_listing_creation_and_media.sql');
  const smoke = await read('scripts/phase4-listing-creation-smoke-local.mjs');
  assert.match(pgTap, /create_v1_listing_submission/);
  assert.match(pgTap, /owner_transition_listing/);
  assert.match(pgTap, /replace_listing_media/);
  assert.match(smoke, /create_v1_listing_submission/);
});
