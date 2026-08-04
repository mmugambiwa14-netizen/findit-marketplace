import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeCreatePeekRequest,
  normalizeDeclinePeekRequest,
  normalizeMergePeekRequests,
  normalizeResponseBinding,
} from '../src/domain/peekThreads/writeContracts.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('create request normalizes directly to RPC arguments', () => {
  const result = normalizeCreatePeekRequest({ listingId: A, category: 'condition', body: '  Show the rear tyres clearly  ' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    p_listing_id: A,
    p_service_id: null,
    p_category: 'condition',
    p_body: 'Show the rear tyres clearly',
  });
});

test('create request requires one parent', () => {
  assert.equal(normalizeCreatePeekRequest({ category: 'custom', body: 'Show this area please' }).ok, false);
  assert.equal(normalizeCreatePeekRequest({ listingId: A, serviceId: B, category: 'custom', body: 'Show this area please' }).ok, false);
});

test('decline requires a valid request and reason', () => {
  assert.equal(normalizeDeclinePeekRequest({ requestId: A, reason: 'Unsafe to record while operating' }).ok, true);
  assert.equal(normalizeDeclinePeekRequest({ requestId: 'bad', reason: '' }).ok, false);
});

test('merge refuses self merge', () => {
  assert.equal(normalizeMergePeekRequests({ sourceRequestId: A, targetRequestId: A }).ok, false);
  assert.equal(normalizeMergePeekRequests({ sourceRequestId: A, targetRequestId: B }).ok, true);
});

test('response binding deduplicates and caps requests', () => {
  const result = normalizeResponseBinding({ tourId: A, requestIds: [B, B] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.p_request_ids, [B]);
  assert.equal(normalizeResponseBinding({ tourId: A, requestIds: [] }).ok, false);
});

test('migration preserves the existing video pipeline and enforces binding invariants', async () => {
  const sql = await readFile(new URL('../supabase/migrations/0119_peek_thread_write_api.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function public\.create_peek_request/i);
  assert.match(sql, /create or replace function public\.support_peek_request/i);
  assert.match(sql, /create or replace function public\.merge_peek_request/i);
  assert.match(sql, /create or replace function public\.bind_response_peek/i);
  assert.match(sql, /v_tour\.peek_kind <> 'response'/i);
  assert.match(sql, /v_tour\.status <> 'published'/i);
  assert.match(sql, /v_tour\.moderation_status <> 'approved'/i);
  assert.match(sql, /update public\.peek_request_responses\s+set is_current = false/i);
  assert.doesNotMatch(sql, /insert into public\.listing_tour_slots/i);
  assert.doesNotMatch(sql, /update public\.listing_tour_slots/i);
});
