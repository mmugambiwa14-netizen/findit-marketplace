import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  boundaryRepair,
  boundaryRepairRollback,
  messaging,
  support,
  listingMedia,
  marketplaceMedia,
  tourUpload,
  tourReports,
  contactReveal,
  peekWrites,
  business,
] = await Promise.all([
  read('supabase/migrations/20260808070000_abuse_rate_limit_buckets.sql'),
  read('supabase/rollback/20260808070000_abuse_rate_limit_buckets.rollback.sql'),
  read('supabase/migrations/20260808071000_restore_private_boundary_after_abuse_limits.sql'),
  read('supabase/rollback/20260808071000_restore_private_boundary_after_abuse_limits.rollback.sql'),
  read('supabase/migrations/0018_v1_messaging.sql'),
  read('supabase/migrations/0025_v1_contact_support.sql'),
  read('supabase/migrations/0021_v1_listing_creation_and_media.sql'),
  read('supabase/migrations/0022_v1_marketplace_profile_media.sql'),
  read('supabase/migrations/0032_v1_tour_storage_and_upload.sql'),
  read('supabase/migrations/0034_v1_tour_moderation_and_reports.sql'),
  read('supabase/migrations/0109_seller_contact_reveal_boundary.sql'),
  read('supabase/migrations/0119_peek_thread_write_api.sql'),
  read('supabase/migrations/20260806041500_curated_business_marketplace_foundation.sql'),
]);

test('abuse limiter is a compact private token-bucket ledger with hashed subjects', () => {
  assert.match(migration, /create table if not exists private\.abuse_rate_limit_buckets/);
  assert.match(migration, /primary key \(scope, subject_hash\)/);
  assert.match(migration, /extensions\.digest\(convert_to\(v_subject, 'UTF8'\), 'sha256'\)/);
  assert.match(migration, /on conflict \(scope, subject_hash\) do nothing/);
  assert.match(migration, /for update;/);
  assert.match(migration, /v_elapsed_seconds \* p_capacity::numeric \/ p_refill_seconds::numeric/);
  assert.match(migration, /denied_count = denied_count \+ 1/);
  assert.match(migration, /retry_after_seconds := greatest\(1, v_retry::integer\)/);
  assert.doesNotMatch(migration, /create table[^;]+(?:email|ip_address|raw_subject)/is);
  assert.match(migration, /revoke all on table private\.abuse_rate_limit_buckets[\s\S]*service_role/);
});

test('existing abuse-sensitive mutation families are bound to the shared limiter', () => {
  const bindings = [
    ['inquiries', 'trg_inquiries_abuse_budget'],
    ['support_requests', 'trg_support_requests_abuse_budget'],
    ['listing_upload_intents', 'trg_listing_upload_intents_abuse_budget'],
    ['marketplace_image_upload_intents', 'trg_marketplace_image_upload_intents_abuse_budget'],
    ['listing_tour_upload_intents', 'trg_listing_tour_upload_intents_abuse_budget'],
    ['contact_reveal_events', 'trg_contact_reveal_events_abuse_budget'],
    ['peek_requests', 'trg_peek_requests_abuse_budget'],
    ['reports', 'trg_reports_abuse_budget'],
    ['business_applications', 'trg_business_applications_abuse_budget'],
    ['managed_listing_requests', 'trg_managed_listing_requests_abuse_budget'],
  ];
  for (const [table, trigger] of bindings) {
    assert.match(migration, new RegExp(`create trigger ${trigger}[\\s\\S]*before insert on public\\.${table}`));
  }
});

test('bucket budgets preserve established public limits and add bounded business/report controls', () => {
  for (const contract of [
    /'message\.minute',[\s\S]*10, 60/,
    /'message\.day',[\s\S]*200, 86400/,
    /'support\.email\.15m',[\s\S]*3, 900/,
    /'support\.email\.day',[\s\S]*10, 86400/,
    /'upload\.listing_image\.hour',[\s\S]*60, 3600/,
    /'upload\.marketplace_image\.hour',[\s\S]*40, 3600/,
    /'upload\.peek_video\.hour',[\s\S]*10, 3600/,
    /'contact_reveal\.day',[\s\S]*40, 86400/,
    /'peek_request\.category\.30m',[\s\S]*3, 1800/,
    /'report\.peek\.day',[\s\S]*10, 86400/,
    /'report\.general\.day',[\s\S]*20, 86400/,
    /'business_application\.day',[\s\S]*5, 86400/,
    /'managed_listing_request\.day',[\s\S]*20, 86400/,
  ]) assert.match(migration, contract);

  assert.match(messaging, /interval '1 minute'[\s\S]*>= 10/);
  assert.match(messaging, /interval '24 hours'[\s\S]*>= 200/);
  assert.match(support, /interval '15 minutes'[\s\S]*>= 3/);
  assert.match(listingMedia, /interval '1 hour'[\s\S]*>= 60/);
  assert.match(marketplaceMedia, /interval '1 hour'[\s\S]*>= 40/);
  assert.match(tourUpload, /interval '1 hour'[\s\S]*>= 10/);
  assert.match(tourReports, /interval '24 hours'[\s\S]*>= 10/);
  assert.match(contactReveal, /v_limit constant integer := 40/);
  assert.match(peekWrites, /interval '30 minutes'[\s\S]*v_recent_count >= 3/);
  assert.match(business, /submit_business_application/);
  assert.match(business, /submit_managed_listing_request/);
});

test('private helper schema reachability is restored without exposing limiter internals', () => {
  assert.match(boundaryRepair, /grant usage on schema private to anon, authenticated/);
  assert.match(boundaryRepair, /has_schema_privilege\('anon', 'private', 'USAGE'\)/);
  assert.match(boundaryRepair, /has_schema_privilege\('authenticated', 'private', 'USAGE'\)/);
  assert.match(boundaryRepair, /has_schema_privilege\('authenticated', 'private', 'CREATE'\)/);
  assert.doesNotMatch(boundaryRepair, /grant create on schema private/i);
  assert.match(boundaryRepair, /revoke all on table private\.abuse_rate_limit_buckets[\s\S]*service_role/);
  assert.match(boundaryRepair, /revoke all on function private\.consume_abuse_rate_limit[\s\S]*service_role/);
  assert.match(boundaryRepair, /revoke all on function private\.require_abuse_rate_limit[\s\S]*service_role/);
});

test('rate-limit maintenance is service-only, bounded and NULL-safe', () => {
  assert.match(migration, /create or replace function public\.prune_abuse_rate_limit_buckets/);
  assert.match(boundaryRepair, /create or replace function public\.prune_abuse_rate_limit_buckets/);
  assert.match(boundaryRepair, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(boundaryRepair, /p_limit not between 1 and 50000/);
  assert.match(boundaryRepair, /limit p_limit[\s\S]*for update skip locked/);
  assert.match(boundaryRepair, /grant execute on function public\.prune_abuse_rate_limit_buckets\(integer\)[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function private\.consume_abuse_rate_limit[^;]+to (?:anon|authenticated)/i);
});

test('rollbacks preserve limiter evidence and do not reintroduce the private-boundary regression', () => {
  for (const trigger of [
    'trg_inquiries_abuse_budget',
    'trg_support_requests_abuse_budget',
    'trg_listing_upload_intents_abuse_budget',
    'trg_marketplace_image_upload_intents_abuse_budget',
    'trg_listing_tour_upload_intents_abuse_budget',
    'trg_contact_reveal_events_abuse_budget',
    'trg_peek_requests_abuse_budget',
    'trg_reports_abuse_budget',
    'trg_business_applications_abuse_budget',
    'trg_managed_listing_requests_abuse_budget',
  ]) assert.match(rollback, new RegExp(`drop trigger if exists ${trigger}`));
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
  assert.match(rollback, /preserve private\.abuse_rate_limit_buckets/);
  assert.match(boundaryRepairRollback, /grant usage on schema private to anon, authenticated/);
  assert.doesNotMatch(boundaryRepairRollback, /create or replace function public\.prune_abuse_rate_limit_buckets/i);
  assert.match(boundaryRepairRollback, /revoke all on function public\.prune_abuse_rate_limit_buckets\(integer\)[\s\S]*from public, anon, authenticated/);
  assert.match(boundaryRepairRollback, /grant execute on function public\.prune_abuse_rate_limit_buckets\(integer\)[\s\S]*to service_role/);
  assert.doesNotMatch(boundaryRepairRollback, /revoke .*schema private from (?:anon|authenticated)/i);
  assert.doesNotMatch(boundaryRepairRollback, /drop table|truncate|delete from/i);
});
