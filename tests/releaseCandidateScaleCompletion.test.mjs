import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizePublicSearchCursor,
  normalizePublicSearchPageRequest,
} from '../src/services/searchContracts.js';
import {
  normalizeNotificationPageRequest,
  normalizeNotificationRow,
} from '../src/services/notificationContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  searchV2Migration,
  searchCardMigration,
  rollback,
  observabilityMigration,
  observabilityRollback,
  searchPage,
  listingResults,
  searchRepository,
  searchService,
  notificationPage,
  notificationRepository,
  notificationService,
  fanoutWorker,
  observabilityWorker,
  supabaseConfig,
  maintenanceWorkflow,
  stagingWorkflow,
  validator,
  envExample,
  packageJson,
] = await Promise.all([
  read('supabase/migrations/0041_v1_public_search_and_notification_scale.sql'),
  read('supabase/migrations/20260808020000_currency_safe_public_listing_search_v2.sql'),
  read('supabase/migrations/20260808043000_public_listing_search_card_projection.sql'),
  read('supabase/rollback/0041_v1_public_search_and_notification_scale.rollback.sql'),
  read('supabase/migrations/0042_v1_release_observability_completion.sql'),
  read('supabase/rollback/0042_v1_release_observability_completion.rollback.sql'),
  read('src/pages/Search.jsx'),
  read('src/components/search/ListingResults.jsx'),
  read('src/repositories/publicListingsRepository.js'),
  read('src/services/publicListingsService.js'),
  read('src/pages/NotificationCenter.jsx'),
  read('src/repositories/notificationsRepository.js'),
  read('src/services/notificationsService.js'),
  read('supabase/functions/essential-notification-fanout/index.ts'),
  read('supabase/functions/tour-observability-monitor/index.ts'),
  read('supabase/config.toml'),
  read('.github/workflows/maintenance-workers.yml'),
  read('.github/workflows/tours-staging-acceptance.yml'),
  read('scripts/validate-env.mjs'),
  read('.env.example'),
  read('package.json'),
]);

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

test('public browse keeps generated search indexing and promotes thin currency-safe deterministic keysets', () => {
  assert.match(migration, /search_document tsvector generated always/);
  assert.match(migration, /idx_listings_search_document/);
  for (const index of ['idx_listings_public_newest', 'idx_listings_public_views']) {
    assert.match(migration, new RegExp(index));
  }
  for (const index of ['idx_listings_public_currency_price_asc', 'idx_listings_public_currency_price_desc']) {
    assert.match(searchV2Migration, new RegExp(index));
  }
  const rpc = searchCardMigration.match(/create or replace function private\.public_listing_search_card_page_v1[\s\S]*?\n\$\$;/)?.[0] || '';
  assert.match(rpc, /\(listing\.created_at, listing\.id\) < \(cursor_time, p_cursor_id\)/);
  assert.match(rpc, /\(coalesce\(listing\.native_price, listing\.price\), listing\.id\) > \(cursor_number, p_cursor_id\)/);
  assert.match(rpc, /\(coalesce\(listing\.native_price, listing\.price\), listing\.id\) < \(cursor_number, p_cursor_id\)/);
  assert.match(rpc, /\(listing\.views, listing\.id\) < \(cursor_views, p_cursor_id\)/);
  assert.match(rpc, /listing\.content_suspended_at is null/);
  assert.match(rpc, /jsonb_build_array\(listing\.photos -> 0\)/);
  assert.match(rpc, /limit p_limit \+ 1/);
  assert.doesNotMatch(rpc, /offset|count\(\*\).*over|count\(\*\).*total/i);
  const resultBlock = rpc.match(/returns table \([\s\S]*?\)\s*language plpgsql/i)?.[0] || '';
  assert.doesNotMatch(resultBlock, /description text|deposit numeric|agent_fee numeric|additional_fees numeric|created_via text|updated_at timestamptz/);
});

test('active Search page uses bounded infinite thin-card pages and no exact totals', () => {
  assert.match(searchPage, /useInfiniteQuery/);
  assert.match(searchPage, /searchPublicListingsPage/);
  assert.match(searchPage, /getNextPageParam/);
  assert.match(searchPage, /useDebouncedValue/);
  assert.match(searchPage, /250/);
  assert.match(searchPage, /currency/);
  assert.match(listingResults, /Load more/);
  assert.doesNotMatch(searchPage, /totalPages|setPage\(|pageSize\s*\*|count:\s*['"]exact['"]/);
  assert.doesNotMatch(listingResults, /total results|page \d|totalPages/i);
  assert.match(searchRepository, /public_listing_search_card_page_v1/);
  assert.match(searchService, /values\.length > request\.pageSize/);
  assert.match(searchService, /nextCursor/);
});

test('executable search cursor contracts cover every supported sort', () => {
  assert.deepEqual(normalizePublicSearchCursor({ id: UUID_A, value: '2026-07-27T12:00:00Z' }, 'newest'), {
    id: UUID_A,
    value: '2026-07-27T12:00:00.000Z',
  });
  assert.deepEqual(normalizePublicSearchCursor({ id: UUID_A, value: 12500.5 }, 'price_asc'), {
    id: UUID_A,
    value: '12500.5',
  });
  assert.deepEqual(normalizePublicSearchCursor({ id: UUID_A, value: 42 }, 'most_viewed'), {
    id: UUID_A,
    value: '42',
  });
  const request = normalizePublicSearchPageRequest({ kind: 'car', currency: 'USD', sort: 'price_desc', cursor: { id: UUID_A, value: 5000 } });
  assert.equal(request.pageSize, 24);
  assert.equal(request.currency, 'USD');
  assert.equal(request.sort, 'price_desc');
  assert.deepEqual(request.cursor, { id: UUID_A, value: '5000' });
  assert.throws(() => normalizePublicSearchCursor({ id: UUID_A, value: 1.5 }, 'most_viewed'), /views are invalid/);
  assert.throws(() => normalizePublicSearchCursor({ id: 'bad', value: 1 }, 'price_desc'), /id is invalid/);
});

test('notifications use bounded owner keysets and retain only essential event types', () => {
  const rpc = migration.match(/create or replace function public\.notification_rows_page[\s\S]*?\n\$\$;/)?.[0] || '';
  assert.match(migration, /idx_app_alerts_owner_cursor/);
  assert.match(migration, /idx_app_alerts_owner_unread_cursor/);
  assert.match(rpc, /a\.user_id = auth\.uid\(\)/);
  assert.match(rpc, /\(a\.created_at, a\.id\) < \(p_cursor_at, p_cursor_id\)/);
  assert.match(rpc, /limit p_limit \+ 1/);
  assert.doesNotMatch(rpc, /offset|count\(\*\).*over/i);
  for (const event of ['tour_ready', 'tour_failed', 'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable']) {
    assert.match(migration, new RegExp(event));
    assert.match(notificationPage, new RegExp(event));
  }
  assert.match(notificationPage, /useInfiniteQuery/);
  assert.match(notificationPage, /PAGE_SIZE = 50/);
  assert.match(notificationRepository, /notification_rows_page/);
  assert.match(notificationService, /rows\.length > request\.limit/);
});

test('executable notification contracts validate cursors and safe canonical links', () => {
  assert.deepEqual(normalizeNotificationPageRequest({ limit: 50, cursor: { id: UUID_B, createdAt: '2026-07-27T10:00:00Z' } }), {
    eventType: 'all',
    unreadOnly: false,
    limit: 50,
    cursor: { id: UUID_B, createdAt: '2026-07-27T10:00:00.000Z' },
  });
  const row = normalizeNotificationRow({
    notification_id: UUID_A,
    event_type: 'saved_listing_unavailable',
    title: 'Saved listing unavailable',
    message: 'The listing is no longer available.',
    link: `/property/${UUID_B}`,
    is_read: false,
    read_at: null,
    listing_id: UUID_B,
    created_at: '2026-07-27T10:00:00Z',
  });
  assert.equal(row.link, `/property/${UUID_B}`);
  assert.equal(normalizeNotificationRow({ ...row, notification_id: UUID_A, event_type: 'tour_ready', created_at: row.created_date, link: 'https://evil.invalid' }).link, null);
  assert.throws(() => normalizeNotificationPageRequest({ limit: 51 }), /limit is invalid/);
});

test('saved-listing fan-out is asynchronous, bounded, leased and idempotent', () => {
  assert.match(migration, /create table public\.essential_notification_fanout_jobs/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /p_limit not between 1 and 25/);
  assert.match(migration, /p_recipient_limit not between 1 and 500/);
  assert.match(migration, /limit p_recipient_limit \+ 1/);
  assert.match(migration, /saved-unavailable:' \|\| job\.id::text \|\| ':' \|\| recipient\.user_id::text/);
  assert.match(migration, /on conflict \(user_id, event_type, source_key\)/);
  assert.match(migration, /lease_expired/);
  assert.match(migration, /dead_lettered/);
  assert.match(migration, /power\(2::numeric/);
  assert.match(migration, /grant execute on function public\.claim_notification_fanout_jobs[\s\S]*to service_role/);
  assert.match(migration, /revoke all on table public\.essential_notification_fanout_jobs from anon, authenticated/);
});

test('fan-out worker uses a dedicated scheduler secret and bounded batches', () => {
  assert.match(fanoutWorker, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(fanoutWorker, /jobLimit < 1 \|\| jobLimit > 25/);
  assert.match(fanoutWorker, /recipientLimit < 1 \|\| recipientLimit > 500/);
  assert.match(fanoutWorker, /claim_notification_fanout_jobs/);
  assert.match(fanoutWorker, /process_notification_fanout_job/);
  assert.match(fanoutWorker, /fail_notification_fanout_job/);
  assert.doesNotMatch(fanoutWorker, /recipient\.user_id|listing_row\.title|notification body/i);
  assert.match(supabaseConfig, /\[functions\.essential-notification-fanout\][\s\S]*verify_jwt = false/);
  assert.match(maintenanceWorkflow, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED/);
  assert.match(maintenanceWorkflow, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
});

test('fan-out health uses aggregate alerts and bounded completed-job retention', () => {
  for (const alert of ['notification_fanout_dead_letters', 'notification_fanout_backlog', 'notification_fanout_stale_claims']) {
    assert.match(observabilityMigration, new RegExp(alert));
  }
  assert.match(observabilityMigration, /admin_notification_fanout_health/);
  assert.match(observabilityMigration, /prune_notification_fanout_jobs/);
  assert.match(observabilityMigration, /state = 'completed' and completed_at < p_before/);
  assert.match(observabilityWorker, /evaluate_notification_fanout_alerts/);
  assert.match(observabilityWorker, /notificationFanout/);
  assert.doesNotMatch(observabilityMigration, /jsonb_build_object\([^\n]*(user_id|listing_id)|metric_name[^\n]*(recipient|user)/i);
});

test('worker environment remains closed by default and staging acceptance includes scale gates', () => {
  assert.match(validator, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED/);
  assert.match(validator, /FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET/);
  assert.match(envExample, /FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED=false/);
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:search-scale-local'], 'node ./scripts/phase7-search-scale-smoke-local.mjs');
  assert.equal(pkg.scripts['test:notification-scale-local'], 'node ./scripts/notification-scale-smoke-local.mjs');
  assert.match(stagingWorkflow, /test:search-scale-hosted/);
  assert.match(stagingWorkflow, /test:notification-scale-hosted/);
});

test('targeted rollbacks preserve marketplace, notifications and incident evidence', () => {
  assert.doesNotMatch(rollback, /drop table public\.app_alerts|delete from public\.app_alerts|drop table public\.listings|delete from public\.listings/);
  assert.doesNotMatch(rollback, /drop table public\.essential_notification_fanout_jobs|delete from public\.essential_notification_fanout_jobs/);
  assert.match(rollback, /preserv/i);
  assert.doesNotMatch(observabilityRollback, /drop table public\.operational_metric_buckets|delete from public\.operational_metric_buckets/);
  assert.doesNotMatch(observabilityRollback, /drop table public\.essential_notification_fanout_jobs|delete from public\.essential_notification_fanout_jobs/);
});
