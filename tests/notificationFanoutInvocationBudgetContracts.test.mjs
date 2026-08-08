import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [worker, migration] = await Promise.all([
  read('supabase/functions/essential-notification-fanout/index.ts'),
  read('supabase/migrations/0041_v1_public_search_and_notification_scale.sql'),
]);

test('notification fanout caps total recipient work before claiming jobs', () => {
  assert.match(worker, /const MAX_RECIPIENTS_PER_INVOCATION = 2_000/);
  assert.match(worker, /const claimLimit = Math\.min\([\s\S]*?jobLimit,[\s\S]*?Math\.max\(1, Math\.floor\(MAX_RECIPIENTS_PER_INVOCATION \/ recipientLimit\)\)/);
  assert.match(worker, /claim_notification_fanout_jobs/);
  assert.match(worker, /p_limit: claimLimit/);
  assert.doesNotMatch(worker, /claim_notification_fanout_jobs[\s\S]{0,160}p_limit: jobLimit/);
});

test('external worker limits remain bounded independently of the invocation budget', () => {
  assert.match(worker, /jobLimit < 1 \|\| jobLimit > 25/);
  assert.match(worker, /recipientLimit < 1 \|\| recipientLimit > 500/);
  assert.match(worker, /payload\.jobLimit === undefined \? 10/);
  assert.match(worker, /payload\.recipientLimit === undefined \? 200/);
});

test('database recipient traversal is indexed keyset pagination rather than rescanning offsets', () => {
  assert.match(migration, /idx_saved_listings_listing_user[\s\S]*?saved_listings\(listing_id, user_id\)/);
  const processStart = migration.indexOf('create or replace function public.process_notification_fanout_job(');
  const failStart = migration.indexOf('create or replace function public.fail_notification_fanout_job(', processStart);
  assert.notEqual(processStart, -1);
  assert.notEqual(failStart, -1);
  const processBlock = migration.slice(processStart, failStart);
  assert.match(processBlock, /job\.cursor_user_id is null or s\.user_id > job\.cursor_user_id/);
  assert.match(processBlock, /order by s\.user_id/);
  assert.match(processBlock, /limit p_recipient_limit \+ 1/);
  assert.doesNotMatch(processBlock, /\boffset\b/i);
});

test('partial batches requeue without holding claims and delivery stays idempotent', () => {
  const processStart = migration.indexOf('create or replace function public.process_notification_fanout_job(');
  const failStart = migration.indexOf('create or replace function public.fail_notification_fanout_job(', processStart);
  const processBlock = migration.slice(processStart, failStart);
  assert.match(processBlock, /state = case when has_more then 'pending' else 'completed' end/);
  assert.match(processBlock, /next_attempt_at = case when has_more then now\(\) else next_attempt_at end/);
  assert.match(processBlock, /claim_token = null, claimed_at = null/);
  assert.match(processBlock, /'saved-unavailable:' \|\| job\.id::text \|\| ':' \|\| recipient\.user_id::text/);
  assert.match(migration, /on conflict \(user_id, event_type, source_key\)/);
});

test('queue claiming remains due-indexed and concurrency-safe', () => {
  assert.match(migration, /idx_notification_fanout_due[\s\S]*?next_attempt_at, created_at, id[\s\S]*?where state = 'pending'/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /p_limit not between 1 and 25/);
});
