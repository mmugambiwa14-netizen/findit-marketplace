import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  normalizeMessageInboxPageRequest,
  normalizeMessageThreadPageRequest,
  normalizeMessagingCursor,
} from '../src/services/messagingContracts.js';
import { normalizeAdminHealthWindow } from '../src/services/adminContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  inboxPage,
  threadPage,
  messagingRepository,
  messagingService,
  runtime,
  feedFunction,
  playbackFunction,
  observabilityFunction,
  supabaseConfig,
  maintenanceWorkflow,
  stagingWorkflow,
  adminRepository,
  adminService,
  adminDashboard,
  adminHealth,
  validator,
  envExample,
  packageJson,
  sourceGraph,
  messagingScaleSmoke,
  toursScaleSmoke,
  observabilitySmoke,
  certification,
] = await Promise.all([
  read('supabase/migrations/0040_v1_scale_hardening_and_observability.sql'),
  read('supabase/rollback/0040_v1_scale_hardening_and_observability.rollback.sql'),
  read('src/pages/Inquiries.jsx'),
  read('src/components/messaging/ConversationThread.jsx'),
  read('src/repositories/messagingRepository.js'),
  read('src/services/messagingService.js'),
  read('supabase/functions/_shared/tour-runtime.ts'),
  read('supabase/functions/tour-feed/index.ts'),
  read('supabase/functions/tour-playback-access/index.ts'),
  read('supabase/functions/tour-observability-monitor/index.ts'),
  read('supabase/config.toml'),
  read('.github/workflows/maintenance-workers.yml'),
  read('.github/workflows/deploy-staging-pages.yml'),
  read('src/repositories/adminRepository.js'),
  read('src/services/adminService.js'),
  read('src/pages/admin/AdminDashboard.jsx'),
  read('src/components/admin/AdminOperationalHealth.jsx'),
  read('scripts/validate-env.mjs'),
  read('.env.example'),
  read('package.json'),
  read('scripts/verify-source-graph.mjs'),
  read('scripts/messaging-scale-smoke-local.mjs'),
  read('scripts/tours-scale-smoke-local.mjs'),
  read('scripts/tours-observability-smoke-local.mjs'),
  read('scripts/tours-release-certification.mjs'),
]);

const CURSOR_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';

test('message inbox uses bounded keyset pagination with a deterministic index', () => {
  assert.match(migration, /idx_inquiries_conversation_cursor/);
  assert.match(migration, /idx_listing_tours_public_feed_cursor/);
  assert.match(migration, /create or replace function public\.message_inbox_page/);
  assert.match(migration, /\(row_last_message_at, row_conversation_id\) < \(p_cursor_at, p_cursor_id\)/);
  assert.match(migration, /order by row_last_message_at desc, row_conversation_id desc/);
  assert.match(migration, /limit p_limit \+ 1/);
  assert.match(migration, /p_limit not between 1 and 50/);
  assert.doesNotMatch(migration.match(/create or replace function public\.message_inbox_page[\s\S]*?\n\$\$;/)?.[0] || '', /offset|count\(\*\).*total/i);
});

test('message threads use participant-guarded keyset pages and never load a full thread', () => {
  assert.match(migration, /create or replace function public\.message_thread_page/);
  assert.match(migration, /\(i\.created_at, i\.id\) < \(p_before_created_at, p_before_id\)/);
  assert.match(migration, /p_limit not between 1 and 50/);
  assert.match(migration, /c\.buyer_id = auth\.uid\(\) or c\.seller_id = auth\.uid\(\)/);
  assert.match(threadPage, /useInfiniteQuery/);
  assert.match(threadPage, /Load older messages/);
  assert.match(threadPage, /PAGE_SIZE = 50/);
  assert.doesNotMatch(threadPage, /p_limit:\s*200|getMessageConversation\(/);
});

test('frontend inbox uses cursor pages without exact counts or offset state', () => {
  assert.match(inboxPage, /useInfiniteQuery/);
  assert.match(inboxPage, /getNextPageParam/);
  assert.match(inboxPage, /Load more/);
  assert.match(inboxPage, /PAGE_SIZE = 30/);
  assert.doesNotMatch(inboxPage, /offset|totalPages|exact count/i);
  assert.match(messagingRepository, /message_inbox_page/);
  assert.match(messagingRepository, /message_thread_page/);
  assert.match(messagingService, /values\.length > request\.limit/);
  assert.match(messagingService, /nextCursor/);
});

test('executable cursor contracts reject malformed and oversized page requests', () => {
  assert.deepEqual(normalizeMessagingCursor({ at: '2026-07-27T12:00:00Z', id: CURSOR_ID }), {
    at: '2026-07-27T12:00:00.000Z', id: CURSOR_ID,
  });
  assert.deepEqual(normalizeMessageInboxPageRequest({ query: '  Hilux  ', unreadOnly: 1, limit: 30 }), {
    query: 'Hilux', unreadOnly: true, limit: 30, cursor: null,
  });
  assert.deepEqual(normalizeMessageThreadPageRequest(CONVERSATION_ID, { limit: 50 }), {
    conversationId: CONVERSATION_ID, limit: 50, cursor: null,
  });
  assert.throws(() => normalizeMessagingCursor({ at: 'not-a-date', id: CURSOR_ID }), /timestamp is invalid/);
  assert.throws(() => normalizeMessageInboxPageRequest({ limit: 51 }), /limit is invalid/);
  assert.throws(() => normalizeMessageThreadPageRequest(CONVERSATION_ID, { limit: 0 }), /limit is invalid/);
});

test('operational metrics are compact hourly aggregates with no public table access', () => {
  assert.match(migration, /create table public\.operational_metric_buckets/);
  assert.match(migration, /primary key \(bucket_start, metric_name, dimension\)/);
  assert.match(migration, /date_trunc\('hour'/);
  assert.match(migration, /sample_count bigint/);
  assert.match(migration, /revoke all on table public\.operational_metric_buckets from anon, authenticated/);
  assert.match(migration, /No user content, IP addresses, or raw per-request event stream/);
});

test('Tour lifecycle and messaging writes emit the required operational signals', () => {
  for (const metric of [
    'upload_intent_created', 'upload_completed', 'upload_abandoned',
    'processing_dispatched', 'processing_completed_latency_ms', 'processing_failed',
    'cleanup_completed', 'cleanup_failed',
    'cache_invalidation_completed', 'cache_invalidation_failed',
    'tour_report_submitted', 'message_send_latency_ms',
  ]) assert.match(migration, new RegExp(metric));
  assert.match(migration, /jsonb_build_object\('failure_code'/);
  assert.match(migration, /coalesce\(new\.tour_reason::text, new\.reason::text\)/);
  assert.doesNotMatch(migration, /record_operational_metric_internal\([\s\S]{0,300}(new\.message|buyer_name|seller_name|storage_path)/);
});

test('feed and playback instrumentation is sampled and cannot expose private source data', () => {
  assert.match(runtime, /shouldSample/);
  assert.match(runtime, /recordOperationalMetric/);
  assert.match(feedFunction, /feed_latency_ms/);
  assert.match(feedFunction, /feed_response_bytes/);
  assert.match(feedFunction, /sampleCount: 100/);
  assert.match(playbackFunction, /playback_access_latency_ms/);
  assert.match(playbackFunction, /playback_access_failed/);
  assert.match(playbackFunction, /if \(playback\.error[\s\S]*recordOperationalMetric\(admin,[\s\S]*playback_access_failed/);
  assert.doesNotMatch(`${feedFunction}\n${playbackFunction}`, /source_storage_path|tour-sources/);
});

test('deterministic alerts cover processing, feed, messaging and worker dead letters', () => {
  for (const alert of [
    'tour_processing_failure_rate', 'tour_abandoned_uploads', 'tour_feed_failures',
    'tour_feed_latency', 'message_send_latency', 'tour_cleanup_dead_letters', 'tour_cache_dead_letters',
  ]) assert.match(migration, new RegExp(alert));
  assert.match(migration, /processing_failure_rate >= 0\.10/);
  assert.match(migration, /feed_failures >= 5/);
  assert.match(migration, /feed_max_latency >= 2000/);
  assert.match(migration, /message_max_latency >= 2000/);
  assert.match(migration, /cleanup_dead_letters >= 1/);
});

test('founder health is admin-only and surfaces queues, storage and alerts', () => {
  assert.match(migration, /create or replace function public\.admin_operational_health/);
  assert.match(migration, /if not public\.is_admin\(\)/);
  assert.match(migration, /'open_alerts'/);
  assert.match(migration, /'queues'/);
  assert.match(migration, /'storage'/);
  assert.match(migration, /findit_operational_storage_snapshot/);
  assert.match(migration, /storage_snapshot_at/);
  assert.match(migration, /storage_source_bytes_retained/);
  const adminHealthSql = migration.match(/create or replace function public\.admin_operational_health[\s\S]*?\n\$\$;/)?.[0] || '';
  assert.doesNotMatch(adminHealthSql, /sum\(source_byte_size\)|sum\(processed_byte_size\)/);
  assert.doesNotMatch(adminHealthSql, /count\(\*\) from public\.listing_tours where status = 'ready'/);
  assert.match(adminRepository, /admin_operational_health/);
  assert.match(adminService, /getAdminOperationalHealth/);
  assert.match(adminDashboard, /AdminOperationalHealth/);
  assert.match(adminHealth, /Operational health/);
  assert.match(adminHealth, /Cleanup dead-lettered/);
  assert.equal(normalizeAdminHealthWindow(24), 24);
  assert.throws(() => normalizeAdminHealthWindow(169), /window is invalid/);
});

test('observability scheduler requires its own secret and enforces metric retention', () => {
  assert.match(observabilityFunction, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(observabilityFunction, /evaluate_operational_alerts/);
  assert.match(observabilityFunction, /prune_operational_metrics/);
  assert.match(supabaseConfig, /\[functions\.tour-observability-monitor\][\s\S]*verify_jwt = false/);
  assert.match(maintenanceWorkflow, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(maintenanceWorkflow, /tour-observability-monitor/);
  assert.match(migration, /now\(\) - interval '90 days'/);
  assert.match(migration, /p_before > now\(\) - interval '30 days'/);
});

test('production Tours activation requires a named accepted staging record', () => {
  assert.match(validator, /FINDIT_TOURS_RELEASE_ACCEPTED/);
  assert.match(validator, /FINDIT_TOURS_ACCEPTANCE_ID/);
  assert.match(validator, /tour-acceptance-/);
  assert.match(validator, /Tours must remain disabled in production/);
  assert.match(envExample, /FINDIT_TOURS_RELEASE_ACCEPTED=false/);
  assert.match(envExample, /FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET/);
  assert.match(stagingWorkflow, /VITE_FEATURE_TOURS_PREVIEW/);
  assert.match(stagingWorkflow, /FINDIT_TOURS_RELEASE_ACCEPTED/);
});

test('scale smoke harnesses traverse multiple pages and enforce authorization', () => {
  assert.match(messagingScaleSmoke, /no duplicates or skips/);
  assert.match(messagingScaleSmoke, /message_inbox_page/);
  assert.match(messagingScaleSmoke, /message_thread_page/);
  assert.match(messagingScaleSmoke, /non-participants cannot page a thread/);
  assert.match(toursScaleSmoke, /FINDIT_TOUR_FEED_FIXTURE_COUNT/);
  assert.match(observabilitySmoke, /ordinary authenticated users cannot read raw operational buckets/);
  assert.match(observabilitySmoke, /deterministic feed failure alert opens at threshold/);
});

test('source graph and release certification are executable package gates', () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['verify:source-graph'], 'node ./scripts/verify-source-graph.mjs');
  assert.equal(pkg.scripts['test:tours-scale-local'], 'node ./scripts/tours-scale-smoke-local.mjs');
  assert.equal(pkg.scripts['test:messaging-scale-local'], 'node ./scripts/messaging-scale-smoke-local.mjs');
  assert.equal(pkg.scripts['test:tours-observability-local'], 'node ./scripts/tours-observability-smoke-local.mjs');
  assert.equal(pkg.scripts['certify:release-candidate'], 'node ./scripts/tours-release-certification.mjs');
  assert.match(sourceGraph, /TypeScript parser is unavailable/);
  assert.match(sourceGraph, /0 unresolved local imports/);
  assert.match(certification, /milestone-7-release-certification\.json/);
  assert.match(certification, /conditionally-passed/);
});

test('rollback preserves operational evidence while restoring pre-hardening messaging writes', () => {
  assert.match(rollback, /Data tables are preserved by default/);
  assert.match(rollback, /Preserve operational_metric_buckets and operational_alerts/);
  assert.match(rollback, /Restore the pre-0040 message functions/);
  assert.doesNotMatch(rollback, /drop table public\.operational_metric_buckets|delete from public\.operational_metric_buckets/);
  assert.doesNotMatch(rollback, /drop table public\.conversations|delete from public\.inquiries/);
});

test('production validator rejects enabled Tours without acceptance evidence', () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: 'production',
    VITE_SUPABASE_URL: 'https://findit-release.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'release-key',
    VITE_FEATURE_BUSINESS_PROFILES: 'true',
    VITE_FEATURE_MESSAGING: 'true',
    VITE_FEATURE_ESSENTIAL_NOTIFICATIONS: 'true',
    VITE_FEATURE_PAYMENTS: 'false',
    VITE_FEATURE_SUBSCRIPTIONS: 'false',
    VITE_FEATURE_ESCROW: 'false',
    VITE_FEATURE_PREMIUM_LISTINGS: 'false',
    VITE_FEATURE_AI_MODERATION: 'false',
    VITE_FEATURE_AI_BAN_EVASION: 'false',
    VITE_FEATURE_AI_TICKET_TRIAGE: 'false',
    VITE_FEATURE_AI_SUPPORT_CHAT: 'false',
    VITE_FEATURE_SCHEDULED_REMINDERS: 'false',
    VITE_FEATURE_MARKETING_EMAILS: 'false',
    VITE_FEATURE_TOURS_PREVIEW: 'false',
    VITE_FEATURE_TOURS: 'true',
    TOURS_BACKEND_ENABLED: 'true',
    FINDIT_TOURS_RELEASE_ACCEPTED: 'false',
    TOUR_PROCESSOR_URL: 'https://processor.findit.invalid/jobs',
    TOUR_PROCESSOR_SECRET: 'secret',
    TOUR_PROCESSING_CALLBACK_URL: 'https://findit-release.supabase.co/functions/v1/tour-processing-callback',
    FINDIT_TOUR_PROCESSING_WORKER_SECRET: 'secret',
    FINDIT_TOUR_CLEANUP_WORKER_SECRET: 'secret',
    FINDIT_TOUR_CACHE_WORKER_SECRET: 'secret',
    FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET: 'secret',
  };
  const result = spawnSync(process.execPath, ['./scripts/validate-env.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: baseEnv,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Tours must remain disabled in production/);
});
