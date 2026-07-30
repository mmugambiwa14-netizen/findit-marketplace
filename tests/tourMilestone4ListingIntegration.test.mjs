import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  scaleMigration,
  rollback,
  tourRepository,
  tourService,
  publicListings,
  favourites,
  savedRepository,
  services,
  sellerProfiles,
  businessProfiles,
  marketplaceCard,
  listingCard,
  serviceCard,
  mediaViewer,
  contactButtons,
  dealerListings,
  publicBusiness,
  conversation,
  inbox,
  messagingService,
  invalidation,
  tourManagement,
  editListing,
  editService,
  myListings,
  manageService,
  guestPrompt,
  packageJson,
  smoke,
] = await Promise.all([
  read('supabase/migrations/0037_v1_listing_tour_integration.sql'),
  read('supabase/migrations/0041_v1_public_search_and_notification_scale.sql'),
  read('supabase/rollback/0037_v1_listing_tour_integration.rollback.sql'),
  read('src/repositories/listingToursRepository.js'),
  read('src/services/listingToursService.js'),
  read('src/services/publicListingsService.js'),
  read('src/services/favouritesService.js'),
  read('src/repositories/publicListingsRepository.js'),
  read('src/services/servicesService.js'),
  read('src/services/sellerProfilesService.js'),
  read('src/services/businessProfilesService.js'),
  read('src/components/marketplace/MarketplaceCard.jsx'),
  read('src/components/listings/ListingCard.jsx'),
  read('src/components/services/ServiceCard.jsx'),
  read('src/components/listings/ListingMediaViewer.jsx'),
  read('src/components/listings/ContactButtons.jsx'),
  read('src/components/dealers/DealerListings.jsx'),
  read('src/pages/PublicBusinessProfile.jsx'),
  read('src/components/messaging/ConversationThread.jsx'),
  read('src/pages/Inquiries.jsx'),
  read('src/services/messagingService.js'),
  read('src/lib/canonicalQueryInvalidation.js'),
  read('src/components/tours/TourManagementPanel.jsx'),
  read('src/components/listings/EditListingDialog.jsx'),
  read('src/components/services/EditServiceDialog.jsx'),
  read('src/pages/MyListings.jsx'),
  read('src/components/services/ManageServiceCard.jsx'),
  read('src/components/auth/GuestPromptSheet.jsx'),
  read('package.json'),
  read('scripts/tours-listing-integration-smoke-local.mjs'),
]);

test('public card summaries are metadata-only and signed playback remains a separate boundary', () => {
  assert.match(migration, /create or replace function public\.public_tour_summaries/);
  assert.match(migration, /duration_seconds numeric/);
  assert.doesNotMatch(migration.slice(0, migration.indexOf('-- Saved listings')), /source_storage_path|playback_storage_path|thumbnail_storage_path/);
  assert.match(tourRepository, /supabase\.rpc\('public_tour_summaries'/);
  assert.match(tourService, /attachPublicTourSummaries/);
  assert.match(tourService, /tryGetPublicTourPlayback/);
  assert.match(tourService, /metadata outage must degrade to the canonical image-only listing/i);
  assert.match(publicListings, /attachPublicTourSummaries/);
  assert.doesNotMatch(publicListings, /tryGetPublicTourPlayback/);
  assert.match(services, /attachPublicTourSummaries/);
  assert.doesNotMatch(services, /tryGetPublicTourPlayback/);
  assert.match(mediaViewer, /getPublicTourPlayback/);
  assert.match(mediaViewer, /onClick=\{openTour\}/);
});

test('cards and details use one canonical identity with explicit Peek deep links', () => {
  assert.match(marketplaceCard, /const tourTarget =/);
  assert.match(marketplaceCard, /media=tour/);
  assert.match(marketplaceCard, /\{tourLabel\}\{tourDuration \? ` · \$\{tourDuration\}`/);
  assert.match(listingCard, /tour=\{tourSummary\(listing\)\}/);
  assert.match(serviceCard, /tourLabel="Peek"/);
  assert.match(mediaViewer, /aria-pressed=\{mode === "tour"\}/);
  assert.match(mediaViewer, /requestedTour \? "Play Peek" : tourActionLabel/);
  assert.match(mediaViewer, /onError=\{onPlaybackError\}/);
  assert.match(mediaViewer, /playback link expired or the video could not be loaded/);
  assert.match(mediaViewer, /onClick=\{showPhotos\}/);
  assert.match(mediaViewer, />\s*Photos\s*</);
  assert.match(mediaViewer, /mode === "photos"/);
  assert.match(mediaViewer, /\{hasTour &&/);
  assert.match(mediaViewer, /tourActionLabel/);
  const publicRepository = savedRepository;
  const latestFunction = publicRepository.slice(publicRepository.indexOf('export async function findLatestAvailableListings'), publicRepository.indexOf('export async function findSavedListingsByIds'));
  const searchFunction = publicRepository.slice(publicRepository.indexOf('export async function findPublicListingsPage'), publicRepository.indexOf('export async function findPublicListingTitleSuggestions'));
  const suggestionsFunction = publicRepository.slice(publicRepository.indexOf('export async function findPublicListingTitleSuggestions'), publicRepository.indexOf('export async function findPublicListingById'));
  for (const functionBody of [latestFunction, suggestionsFunction]) {
    assert.match(functionBody, /\.in\('status', \['available', 'under_offer'\]\)/);
  }
  assert.match(searchFunction, /public_listing_search_page/);
  const publicSearchSql = scaleMigration.match(/create or replace function public\.public_listing_search_page[\s\S]*?\n\$\$;/)?.[0] || '';
  assert.match(publicSearchSql, /l\.status in \('available', 'under_offer'\)/);
});

test('saved listings retain canonical unavailable rows and private images without a saved-Peek model', () => {
  assert.match(migration, /select 1\s+from public\.saved_listings saved/);
  assert.match(migration, /from public\.conversations conversation/);
  assert.match(migration, /create policy "listing_media_read"/);
  assert.match(migration, /create policy "listing_image_authorized_read"/);
  assert.match(favourites, /findSavedListingsByIds/);
  assert.match(savedRepository, /export async function findSavedListingsByIds/);
  const normalizedRepository = savedRepository.replaceAll('\r\n', '\n');
  const savedFunction = normalizedRepository.match(
    /export async function findSavedListingsByIds[\s\S]*?(?=\n(?:export async function|const|function) )/,
  )?.[0] ?? '';
  assert.match(savedFunction, /export async function findSavedListingsByIds/);
  assert.doesNotMatch(savedFunction, /\.eq\('status'|\.in\('status'/);
  assert.doesNotMatch(`${migration}\n${favourites}`, /saved_tours|saved_tour_id/i);
  assert.match(contactButtons, /Existing chats remain available, but new enquiries are closed/);
  assert.match(smoke, /saved entitlement is removed/);
});

test('seller and business inventory surfaces reuse standard Peek-aware cards', () => {
  assert.match(sellerProfiles, /attachPublicTourSummaries/);
  assert.match(businessProfiles, /attachPublicTourSummaries/);
  assert.match(dealerListings, /<ListingCard/);
  assert.match(publicBusiness, /<ServiceCard/);
  assert.doesNotMatch(`${dealerListings}\n${publicBusiness}`, /Reels|Videos tab|followers|creator statistics/i);
});

test('chat context preserves listing identity, price and availability without exposing Peek storage', () => {
  assert.match(migration, /listing_price numeric/);
  assert.match(migration, /listing_status text/);
  assert.match(migration, /has_tour boolean/);
  assert.match(migration, /tour_duration_seconds numeric/);
  assert.match(migration, /where id = p_listing_id and status in \('available', 'under_offer'\)/);
  assert.match(conversation, /View listing/);
  assert.match(conversation, /\?media=tour/);
  assert.match(conversation, /conversation\.listing_status/);
  assert.match(inbox, /conversation\.listing_price/);
  assert.match(inbox, /conversation\.has_tour/);
  assert.match(messagingService, /resolveListingImages/);
  assert.doesNotMatch(`${conversation}\n${inbox}\n${messagingService}`, /playback_storage_path|source_storage_path|thumbnail_storage_path/);
});

test('existing conversation participants retain unavailable listing media without reopening Peek playback', () => {
  const conversationEntitlements = migration.match(/from public\.conversations conversation/g) ?? [];
  assert.ok(conversationEntitlements.length >= 3, 'listing rows, media metadata and storage objects require conversation entitlement');
  assert.match(smoke, /remove saved entitlement before chat-context check/);
  assert.match(smoke, /read unavailable listing through existing conversation/);
  assert.match(smoke, /sign unavailable listing image through existing conversation/);
  assert.match(smoke, /hiddenPlayback\.response\.status, 404/);
  assert.match(smoke, /new enquiries close after unavailability/);
});

test('pending-review and live listings expose Peek management without duplicate owner submission', () => {
  assert.match(myListings, /pendingListings\.map[\s\S]*onEdit=\{\(\) => setEditing\(listing\)\}/);
  assert.match(myListings, /onEdit=\{\['available', 'under_offer'\]\.includes\(listing\.status\)/);
  assert.match(editListing, /<TourManagementPanel[\s\S]*parentType="listing"/);
  assert.match(editListing, /const canSubmitForReview = \["draft", "rejected", "expired", "unavailable"\]/);
  assert.match(editListing, /if \(submitForReview && canSubmitForReview\)[\s\S]*changeOwnerListingState\(listing\.id, "submit"\)/);
  assert.match(editListing, /const movedToReview = listing\.status !== "pending_review" && updatedListing\?\.status === "pending_review"/);
  assert.doesNotMatch(editListing, /autoReviewOnEdit/);
});

test('Peek, edit and lifecycle mutations invalidate every canonical projection', () => {
  for (const key of [
    'public-listing-search', 'public-search-suggestions', 'favourite-listings',
    'seller-public-page', 'public-business-profile', 'message-inbox', 'message-conversation',
  ]) assert.match(invalidation, new RegExp(key));
  assert.match(tourManagement, /invalidateCanonicalParentQueries/);
  assert.match(editListing, /invalidateCanonicalParentQueries/);
  assert.match(editService, /invalidateCanonicalParentQueries/);
  assert.match(myListings, /invalidateCanonicalParentQueries/);
  assert.match(manageService, /invalidateCanonicalParentQueries/);
  assert.match(migration, /after update of status, title, price, currency, photos, location_id, category, listing_type/);
  assert.match(migration, /old\.title is not distinct from new\.title/);
  assert.match(migration, /old\.subcategories is not distinct from new\.subcategories/);
  assert.match(migration, /after update of status, title, price, currency, photos, location_id, location_name/);
});

test('guest authentication preserves Peek-selected listing actions', () => {
  assert.match(guestPrompt, /location\.pathname\}\$\{location\.search\}\$\{location\.hash/);
  assert.match(marketplaceCard, /media=tour/);
});

test('targeted rollback restores exact prior policies and valid message functions', () => {
  assert.match(rollback, /status in \('available', 'under_offer', 'rented'\)/);
  assert.match(rollback, /create policy "listing_media_read"/);
  assert.match(rollback, /create policy "listing_image_authorized_read"/);
  assert.match(rollback, /row_other_user_name ilike/);
  assert.doesNotMatch(rollback, /or coalesce ilike/);
  assert.match(rollback, /after update of status on public\.listings/);
  assert.match(rollback, /after update of status on public\.services/);
});

test('package exposes an executable Milestone 4 integration smoke', async () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:tours-integration-local'], 'node ./scripts/tours-listing-integration-smoke-local.mjs');
  assert.match(smoke, /public_tour_summaries/);
  assert.match(smoke, /tour-playback-access/);
  assert.match(smoke, /signed playback URL must resolve/);
  assert.match(smoke, /revokes new signed Tour playback access/);
  assert.match(smoke, /saved unavailable listing/);
  assert.match(smoke, /message_conversation/);
  assert.match(smoke, /listing_status_sold/);
  assert.match(smoke, /createSignedUrl/);
  await access(new URL('../scripts/tours-listing-integration-smoke-local.mjs', import.meta.url));
});
