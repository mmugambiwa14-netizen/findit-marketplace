import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  maintenance,
  repository,
  service,
  dashboard,
  analyticsComponent,
] = await Promise.all([
  read('../supabase/migrations/0072_recommendation_aggregate_analytics.sql'),
  read('../supabase/rollback/0072_recommendation_aggregate_analytics.rollback.sql'),
  read('../supabase/functions/recommendation-maintenance/index.ts'),
  read('../src/repositories/adminRepository.js'),
  read('../src/services/adminService.js'),
  read('../src/pages/admin/AdminDashboard.jsx'),
  read('../src/components/admin/AdminRecommendationAnalytics.jsx'),
]);

test('analytics storage contains aggregate dimensions and no behavioural identities', () => {
  assert.match(migration, /create table if not exists public\.recommendation_service_metrics_daily/);
  assert.match(migration, /metric_date date not null/);
  assert.match(migration, /impression_count bigint/);
  assert.match(migration, /click_count bigint/);
  assert.match(migration, /request_count bigint/);
  const tableBlock = migration.match(
    /create table if not exists public\.recommendation_service_metrics_daily \(([\s\S]*?)\n\);/,
  )?.[1] ?? '';
  assert.doesNotMatch(
    tableBlock,
    /actor_id|anonymous_session_id|listing_id|seller_id|recommendation_request_id|email|phone|message/i,
  );
  assert.match(migration, /force row level security/);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,100}recommendation_service_metrics_daily[\s\S]{0,40}to\s+(?:anon|authenticated)/i,
  );
});

test('analytics attribution and operations are strictly bounded', () => {
  assert.match(migration, /validate_recommendation_analytics_attribution_v1/);
  assert.match(migration, /event_position not between 0 and 23/);
  assert.match(migration, /event_page_size not between 1 and 24/);
  assert.match(migration, /event_surface <> 'listing_detail'/);
  assert.match(migration, /p_metric_date < current_date - 180/);
  assert.match(migration, /p_end_date - p_start_date > 89/);
  assert.match(migration, /p_limit not between 1 and 50000/);
  assert.match(migration, /for update skip locked/);
});

test('analytics reports are admin-only and contain aggregates only', () => {
  assert.match(migration, /if not public\.is_admin\(\)/);
  assert.match(migration, /grant execute on function public\.admin_recommendation_analytics_v1\(date, date\)[\s\S]{0,60}to authenticated/);
  assert.match(migration, /clickThroughRate/);
  assert.match(migration, /admin_reports_include_identity', false/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.admin_recommendation_analytics_v1([\s\S]*?)\n\$\$;/)?.[1] ?? '',
    /actor_id|anonymous_session_id|listing_id|seller_id|recommendation_request_id/i,
  );
});

test('maintenance refreshes and retains analytics independently', () => {
  assert.match(maintenance, /refresh_recommendation_service_metrics_daily_v1/);
  assert.match(maintenance, /purge_recommendation_service_metrics_v1/);
  assert.match(maintenance, /analyticsDatesRefreshed/);
  assert.match(maintenance, /analyticsMetricsDeleted/);
});

test('admin dashboard consumes a normalized aggregate analytics contract', () => {
  assert.match(repository, /admin_recommendation_analytics_v1/);
  assert.match(service, /Math\.min\(Math\.max\(days, 1\), 90\)/);
  assert.match(service, /clickThroughRate: Number/);
  assert.match(dashboard, /AdminRecommendationAnalytics/);
  assert.match(analyticsComponent, /No account or session identities are included/);
  assert.match(analyticsComponent, /Recommendation analytics are unavailable/);
  assert.match(analyticsComponent, /No recommendation delivery has been aggregated yet/);
});

test('analytics rollback preserves data and removes runtime access', () => {
  assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(rollback, /rollback_disabled/);
  assert.match(rollback, /force row level security/);
  assert.match(rollback, /revoke all/);
});
