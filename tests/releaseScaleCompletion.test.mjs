import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { normalizePublicSearchPageRequest } from '../src/services/searchContracts.js';
import { normalizeNotificationPageRequest } from '../src/services/notificationContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  searchMigration,
  searchRollback,
  observabilityMigration,
  observabilityRollback,
  searchPage,
  searchRepository,
  searchService,
  notificationPage,
  notificationRepository,
  notificationService,
  fanoutWorker,
  observabilityWorker,
  maintenanceWorkflow,
  acceptanceWorkflow,
  config,
  packageJson,
  smoke,
] = await Promise.all([
  read('supabase/migrations/0041_v1_public_search_and_notification_scale.sql'),
  read('supabase/rollback/0041_v1_public_search_and_notification_scale.rollback.sql'),
  read('supabase/migrations/0042_v1_release_observability_completion.sql'),
  read('supabase/rollback/0042_v1_release_observability_completion.rollback.sql'),
  read('src/pages/Search.jsx'),
  read('src/repositories/publicListingsRepository.js'),
  read('src/services/publicListingsService.js'),
  read('src/pages/NotificationCenter.jsx'),
  read('src/repositories/notificationsRepository.js'),
  read('src/services/notificationsService.js'),
  read('supabase/functions/essential-notification-fanout/index.ts'),
  read('supabase/functions/tour-observability-monitor/index.ts'),
  read('.github/workflows/maintenance-workers.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('supabase/config.toml'),
  read('package.json'),
  read('scripts/notification-scale-smoke-local.mjs'),
]);

const CURSOR_ID = '11111111-1111-4111-8111-111111111111';

test('active public search uses bounded keyset pages and indexed public status predicates', () => {
  assert.match(searchMigration, /create or replace function public\.public_listing_search_page/);
  assert.match(searchMigration, /l\.status in \('available', 'under_offer'\)/);
  assert.match(searchMigration, /\(l\.created_at, l\.id\) < \(cursor_time, p_cursor_id\)/);
  assert.match(searchMigration, /limit p_limit \+ 1/);
  assert.match(searchMigration, /idx_listings_public_newest/);
  assert.match(searchRepository, /public_listing_search_page/);
  assert.match(searchService, /normalizePublicSearchPageRequest/);
  assert.match(searchService, /nextCursor/);
  assert.match(searchPage, /useInfiniteQuery/);
  assert.doesNotMatch(searchPage, /totalPages|exact count|offset/i);
});

test('public search executable contracts normalize paired sort cursors', () => {
  const request = normalizePublicSearchPageRequest({
    kind: 'car', sort: 'price_desc', cursor: { id: CURSOR_ID, value: '15000.50' },
  });
  assert.equal(request.pageSize, 24);
  assert.deepEqual(request.cursor, { id: CURSOR_ID, value: '15000.5' });
  assert.throws(() => normalizePublicSearchPageRequest({
    kind: 'car', sort: 'newest', cursor: { id: CURSOR_ID, value: 'not-a-date' },
  }), /time is invalid/);
});

test('active notifications use owner-scoped keyset pages with bounded page size', () => {
  assert.match(searchMigration, /create or replace function public\.notification_rows_page/);
  assert.match(searchMigration, /a\.user_id = auth\.uid\(\)/);
  assert.match(searchMigration, /\(a\.created_at, a\.id\) < \(p_cursor_at, p_cursor_id\)/);
  assert.match(searchMigration, /limit p_limit \+ 1/);
  assert.match(notificationRepository, /notification_rows_page/);
  assert.match(notificationService, /nextCursor/);
  assert.match(notificationPage, /useInfiniteQuery/);
  assert.match(notificationPage, /Load more notifications/);
  assert.doesNotMatch(notificationPage, /p_offset|totalPages|count\(\*\) over/i);
});

test('notification cursor contracts reject malformed and oversized input', () => {
  assert.deepEqual(normalizeNotificationPageRequest({
    eventType: 'tour_ready', limit: 50,
    cursor: { id: CURSOR_ID, createdAt: '2026-07-27T12:00:00Z' },
  }), {
    eventType: 'tour_ready', unreadOnly: false, limit: 50,
    cursor: { id: CURSOR_ID, createdAt: '2026-07-27T12:00:00.000Z' },
  });
  assert.throws(() => normalizeNotificationPageRequest({ limit: 51 }), /limit is invalid/);
  assert.throws(() => normalizeNotificationPageRequest({ cursor: { id: CURSOR_ID, createdAt: 'bad' } }), /cursor is invalid/);
});

test('saved-listing notifications fan out asynchronously in bounded leased batches', () => {
  assert.match(searchMigration, /create table public\.essential_notification_fanout_jobs/);
  assert.match(searchMigration, /for update skip locked/);
  assert.match(searchMigration, /p_recipient_limit not between 1 and 500/);
  assert.match(searchMigration, /limit p_recipient_limit \+ 1/);
  assert.match(searchMigration, /cursor_user_id/);
  assert.match(searchMigration, /on conflict \(user_id, event_type, source_key\)/);
  assert.match(searchMigration, /revoke all on table public\.essential_notification_fanout_jobs from anon, authenticated/);
  assert.doesNotMatch(searchMigration.match(/create or replace function public\.queue_saved_listing_unavailable[\s\S]*?\n\$\$;/)?.[0] || '', /from public\.saved_listings/);
});

test('one canonical fanout worker is secret-protected and metrics are not double-counted', async () => {
  assert.match(fanoutWorker, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(fanoutWorker, /notification_fanout_recipients/);
  assert.match(fanoutWorker, /value: 1,[\s\S]*sampleCount: recipientsProcessed/);
  assert.match(fanoutWorker, /notification_fanout_attempt_failed/);
  assert.doesNotMatch(fanoutWorker, /recipient\.user_id|notification body|listing title/i);
  assert.match(config, /\[functions\.essential-notification-fanout\][\s\S]*verify_jwt = false/);
  assert.doesNotMatch(config, /functions\.notification-fanout-worker/);
  await assert.rejects(access(new URL('../supabase/functions/notification-fanout-worker/index.ts', import.meta.url)));
  const routeOccurrences = maintenanceWorkflow.match(/functions\/v1\/essential-notification-fanout/g) ?? [];
  assert.equal(routeOccurrences.length, 1);
});

test('fanout alerting and completed-job retention stay aggregate and bounded', () => {
  assert.match(observabilityMigration, /notification_fanout_dead_letters/);
  assert.match(observabilityMigration, /notification_fanout_backlog/);
  assert.match(observabilityMigration, /notification_fanout_stale_claims/);
  assert.match(observabilityMigration, /create or replace function public\.prune_notification_fanout_jobs/);
  assert.match(observabilityMigration, /state = 'completed' and completed_at < p_before/);
  assert.match(observabilityMigration, /p_before > now\(\) - interval '7 days'/);
  assert.doesNotMatch(observabilityMigration.match(/create or replace function public\.admin_notification_fanout_health[\s\S]*?\n\$\$;/)?.[0] || '', /state = 'completed'/);
  assert.match(observabilityWorker, /prune_notification_fanout_jobs/);
  assert.doesNotMatch(`${observabilityMigration}\n${observabilityWorker}`, /user_id|recipient_id|message text|source_key/);
});

test('scale smoke and hosted acceptance include notification pagination and fanout', () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:notification-scale-local'], 'node ./scripts/notification-scale-smoke-local.mjs');
  assert.equal(
    pkg.scripts['test:notification-scale-hosted'],
    'node ./scripts/run-hosted-smoke.mjs ./scripts/notification-scale-smoke-local.mjs',
  );
  assert.match(smoke, /notification keyset traversal must contain no duplicates or skips/);
  assert.match(smoke, /ordinary users cannot read fan-out jobs/);
  assert.match(smoke, /update\(\{ next_attempt_at: '-infinity' \}\)/);
  assert.match(smoke, /the bounded claim must select the fixture job/);
  assert.match(smoke, /three recipients with a limit of two require exactly two pages/);
  assert.match(smoke, /fixture cleanup must restore the shared \$\{field\} fan-out health count/);
  assert.match(smoke, /from\('app_alerts'\)\.delete\(\)\.eq\('listing_id', listingId\)/);
  assert.match(smoke, /success\(await root\.auth\.admin\.deleteUser\(user\.userId\)/);
  assert.doesNotMatch(smoke, /root\.auth\.admin\.deleteUser\(user\.userId\); \} catch/);
  assert.match(acceptanceWorkflow, /test:notification-scale-hosted/);
  assert.doesNotMatch(acceptanceWorkflow, /run: \|\s*run: \|/);
});

test('targeted rollback order preserves evidence without leaving active emitters', () => {
  assert.match(searchRollback, /drop trigger if exists trg_notification_fanout_metrics/);
  assert.match(searchRollback, /drop trigger if exists trg_listing_saved_unavailable_fanout/);
  assert.match(searchRollback, /essential_notification_fanout_jobs/);
  assert.match(searchRollback, /intentionally preserved/);
  assert.doesNotMatch(searchRollback, /drop table public\.essential_notification_fanout_jobs|delete from public\.app_alerts/);
  assert.match(observabilityRollback, /drop function if exists public\.prune_notification_fanout_jobs/);
  assert.match(observabilityRollback, /drop index if exists public\.idx_notification_fanout_completed_retention/);
  assert.doesNotMatch(observabilityRollback, /delete from public\.essential_notification_fanout_jobs/);
});
