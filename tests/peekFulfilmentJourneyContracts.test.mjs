import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('fulfilment lifecycle extends the existing Response Peek pipeline instead of replacing it', async () => {
  const lifecycle = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  const existing = await read('supabase/migrations/20260805001500_complete_peek_response_request_flow.sql');
  assert.match(existing, /peek_response_binding_intents/);
  assert.match(existing, /apply_pending_response_peek_binding/);
  assert.match(lifecycle, /peek_request_fulfilments/);
  assert.match(lifecycle, /queue_response_peek_binding/);
  assert.doesNotMatch(lifecycle, /create table .*listing_tours/i);
  assert.doesNotMatch(lifecycle, /create table .*peek_request_responses/i);
});

test('seller acceptance is owner-only, request-scoped and retry-bounded', async () => {
  const sql = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  assert.match(sql, /accept_peek_request/);
  assert.match(sql, /Only the listing owner can accept this Peek Request/);
  assert.match(sql, /v_request\.status <> 'pending'/);
  assert.match(sql, /v_request\.moderation_status <> 'approved'/);
  assert.match(sql, /tour_processing_max_attempts/);
  assert.match(sql, /v_existing\.attempt_count >= v_max_attempts/);
  assert.match(sql, /v_existing\.status in \('accepted', 'uploading', 'processing'\)/);
  assert.match(sql, /attempt_count = public\.peek_request_fulfilments\.attempt_count \+ 1/);
});

test('binding requires acceptance and persists upload or processing state', async () => {
  const sql = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  assert.match(sql, /Accept this Peek Request before uploading a response/);
  assert.match(sql, /v_fulfilment\.status not in \('accepted', 'uploading'\)/);
  assert.match(sql, /tour_id = p_tour_id/);
  assert.match(sql, /then 'processing' else 'uploading'/);
  assert.match(sql, /started_at = coalesce\(started_at, now\(\)\)/);
});

test('processing failure cancellation retry and expiry remove abandoned binding intents', async () => {
  const sql = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  assert.match(sql, /new\.status = 'failed' or new\.moderation_status = 'rejected'/);
  assert.match(sql, /delete from public\.peek_response_binding_intents where tour_id = new\.id/);
  assert.match(sql, /cancel_peek_request_fulfilment/);
  assert.match(sql, /delete from public\.peek_response_binding_intents[\s\S]*request_id = p_request_id/);
  assert.match(sql, /if found then[\s\S]*delete from public\.peek_response_binding_intents/);
  assert.match(sql, /f\.status = 'expired'/);
});

test('request terminal states close the fulfilment record consistently', async () => {
  const sql = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  assert.match(sql, /new\.status = 'answered'/);
  assert.match(sql, /status = 'completed'/);
  assert.match(sql, /new\.status in \('declined', 'merged', 'removed'\)/);
  assert.match(sql, /new\.status = 'expired'/);
  assert.match(sql, /peek_request_fulfilment_terminal_consistency/);
});

test('expiry is service-role-only bounded and uses skip-locked batches', async () => {
  const sql = await read('supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql');
  assert.match(sql, /expire_stale_peek_request_fulfilments/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /p_limit < 1 or p_limit > 1000/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /where status in \('accepted', 'uploading', 'processing'\) and expires_at <= now\(\)/);
});

test('seller queue returns persisted fulfilment state with existing keyset pagination', async () => {
  const queue = await read('supabase/migrations/20260807020500_peek_fulfilment_seller_queue.sql');
  const contract = await read('src/domain/peekThreads/sellerQueueContracts.js');
  assert.match(queue, /left join public\.peek_request_fulfilments/);
  assert.match(queue, /fulfilment_status/);
  assert.match(queue, /fulfilment_attempt_count/);
  assert.match(queue, /fulfilment_tour_id/);
  assert.match(queue, /fulfilment_expires_at/);
  assert.match(queue, /limit v_limit \+ 1/);
  assert.match(contract, /fulfilment:/);
  assert.match(contract, /attemptCount/);
  assert.match(contract, /failureReason/);
});

test('client queue exposes Accept Retry Cancel Record and fixes successful-upload closure', async () => {
  const queue = await read('src/components/peekThreads/BuyerPeekRequestsQueue.jsx');
  const service = await read('src/services/peekThreadsService.js');
  const repository = await read('src/repositories/peekThreadsRepository.js');
  assert.match(queue, />Accept</);
  assert.match(queue, />Retry</);
  assert.match(queue, /Cancel attempt/);
  assert.match(queue, /Record response/);
  assert.match(queue, /resetResponse\(\);[\s\S]*finally[\s\S]*setBindingBusy\(false\)/);
  assert.match(service, /acceptPeekRequest/);
  assert.match(service, /cancelPeekRequestFulfilment/);
  assert.match(repository, /accept_peek_request/);
  assert.match(repository, /cancel_peek_request_fulfilment/);
});

test('database journey exercises authorization failure retry completion notification cancellation and expiry', async () => {
  const sql = await read('supabase/tests/v1_peek_fulfilment_journey.sql');
  assert.match(sql, /a non-owner cannot accept a seller Peek Request/);
  assert.match(sql, /queue_response_peek_binding/);
  assert.match(sql, /processing failure becomes a recoverable fulfilment failure/);
  assert.match(sql, /retry increments the persisted attempt counter/);
  assert.match(sql, /approved publication remains the only operation that answers the request/);
  assert.match(sql, /peek_request_answered/);
  assert.match(sql, /cancel_peek_request_fulfilment/);
  assert.match(sql, /expire_stale_peek_request_fulfilments/);
  assert.match(sql, /seller queue reloads the persisted expiry state/);
});

test('fulfilment migrations have complete rollback capsules', async () => {
  const lifecycle = await read('supabase/rollback/20260807020000_peek_request_fulfilment_lifecycle.rollback.sql');
  const queue = await read('supabase/rollback/20260807020500_peek_fulfilment_seller_queue.rollback.sql');
  assert.match(lifecycle, /drop table if exists public\.peek_request_fulfilments/);
  assert.match(lifecycle, /Restore the pre-fulfilment binding-intent contract/);
  assert.match(queue, /drop function if exists public\.seller_peek_request_queue/);
  assert.doesNotMatch(queue, /fulfilment_status/);
});
