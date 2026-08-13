import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [worker, stamper, authContext, pushService, migration, deletionMigration, advisorMigration, toursRepository, imagesService, servicesService] = await Promise.all([
  read('public/sw.js'),
  read('scripts/stamp-service-worker.mjs'),
  read('src/lib/AuthContext.jsx'),
  read('src/services/webPushService.js'),
  read('supabase/migrations/20260812150656_email_notifications_indexes_and_runtime_hardening.sql'),
  read('supabase/migrations/20260804185800_self_service_account_deletion.sql'),
  read('supabase/migrations/20260812160000_runtime_advisor_hardening.sql'),
  read('src/repositories/listingToursRepository.js'),
  read('src/services/marketplaceImagesService.js'),
  read('src/services/servicesService.js'),
]);

test('the registered worker loads push handlers and awaits cache lifecycle work', () => {
  assert.match(worker, /^importScripts\('\/push-sw\.js'\);/);
  assert.match(worker, /await shell\.put\(SHELL_URL/);
  assert.match(worker, /await trimCache\(ASSET_CACHE/);
  assert.match(worker, /\.then\(async \(response\) =>/);
  assert.match(worker, /event\.waitUntil\(network\)/);
});

test('service-worker verification is read-only after stamping', () => {
  assert.match(stamper, /process\.argv\.includes\('--check'\)/);
  assert.match(stamper, /Service worker verification: FAIL/);
  assert.match(stamper, /source\.startsWith\(pushImport\)/);
});

test('auth transitions disable local push and clear account-scoped query state', () => {
  assert.match(authContext, /disableWebPush\(\)\.catch/);
  assert.match(authContext, /queryClientInstance\.clear\(\)/);
  assert.match(authContext, /previousUserIdRef/);
  assert.match(pushService, /await subscription\.unsubscribe\(\)/);
  assert.match(pushService, /remoteError/);
});

test('private browser query keys carry an account boundary', async () => {
  const privateSources = await Promise.all([
    read('src/components/messaging/ConversationThread.jsx'),
    read('src/components/peekThreads/MyPeekRequestsQueue.jsx'),
    read('src/components/peekThreads/BuyerPeekRequestsQueue.jsx'),
    read('src/components/listings/ListingRecommendations.jsx'),
    read('src/components/messaging/RealtimeConversationThread.jsx'),
    read('src/components/notifications/PushNotificationRuntime.jsx'),
    read('src/components/settings/EmailNotificationSettings.jsx'),
    read('src/components/peekThreads/ResponsePeekBindingQueue.jsx'),
    read('src/components/tours/TourManagementPanel.jsx'),
  ]);
  assert.match(privateSources[0], /\['message-thread', accountId, conversationId\]/);
  assert.match(privateSources[1], /\['peek-request-activity', user\?\.id \?\? null/);
  assert.match(privateSources[2], /\['seller-peek-request-queue', user\?\.id \?\? null/);
  assert.match(privateSources[3], /\['listing-recommendations', subjectListingId, includePersonalized, user\?\.id \?\? null\]/);
  assert.match(privateSources[4], /\['message-thread-tail', accountId, conversationId\]/);
  assert.match(privateSources[5], /\['notification-preferences', user\?\.id \?\? null\]/);
  assert.match(privateSources[6], /\['email-notification-preferences', user\?\.id \?\? null\]/);
  assert.match(privateSources[7], /\['unbound-response-peeks', accountId\]/);
  assert.match(privateSources[8], /ownerParent\(parentType, parentId, user\?\.id \?\? null\)/);
});

test('owner Peek history is bounded and service inventory signs one image batch', () => {
  assert.match(toursRepository, /OWNER_TOUR_HISTORY_LIMIT = 50/);
  assert.match(toursRepository, /\.limit\(OWNER_TOUR_HISTORY_LIMIT\)/);
  assert.match(imagesService, /resolveMarketplaceImageMap/);
  assert.match(servicesService, /resolveMarketplaceImageMap\(page\.items, 'service_photo'\)/);
});

test('email preferences and delivery jobs are durable, idempotent and service-only at dispatch', () => {
  assert.match(migration, /create table if not exists public\.email_notification_preferences/);
  assert.match(migration, /create table if not exists public\.email_delivery_jobs/);
  assert.match(migration, /unique references public\.app_alerts\(id\) on delete cascade/);
  assert.match(migration, /on conflict \(alert_id\) do nothing/);
  assert.match(migration, /claim_email_delivery_jobs/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /grant execute on function public\.claim_email_delivery_jobs[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.claim_email_delivery_jobs[\s\S]*to authenticated/);
});

test('email delivery schema covers preferences, retry indexes and missing foreign-key hot paths', () => {
  for (const indexName of [
    'web_push_delivery_jobs_user_status_idx',
    'web_push_delivery_attempts_subscription_idx',
    'business_category_approvals_application_idx',
    'managed_listing_requests_requester_idx',
    'business_application_responses_application_idx',
    'business_review_events_application_idx',
    'peek_response_binding_intents_request_idx',
    'saved_services_service_idx',
    'idx_services_description_trgm',
  ]) assert.match(migration, new RegExp(`create index if not exists ${indexName}`));
});

test('account deletion remains safe before and after email preferences are installed', () => {
  assert.match(deletionMigration, /to_regclass\('public\.email_notification_preferences'\)/);
  assert.match(deletionMigration, /execute 'delete from public\.email_notification_preferences/);
});

test('runtime advisor hardening keeps RLS initplans and retires legacy preference RPC grants', () => {
  assert.match(advisorMigration, /business_applications_reviewed_by_idx/);
  assert.match(advisorMigration, /using \(\(select public\.is_active_user\(\)\)/);
  assert.match(advisorMigration, /with check \([\s\S]*\(select public\.is_active_user\(\)\)/);
  assert.match(advisorMigration, /to_regprocedure\('public\.get_web_push_notification_preferences\(\)'\)/);
  assert.match(advisorMigration, /revoke all on function public\.update_web_push_notification_preferences/);
});
