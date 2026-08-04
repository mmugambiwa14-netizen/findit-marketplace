import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import {
  normalizePeekThreadPage,
  normalizePeekThreadReadRequest,
  PEEK_THREAD_MAX_PAGE_SIZE,
} from '../src/domain/peekThreads/readContracts.js';

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const CURSOR_ID = '22222222-2222-4222-8222-222222222222';

test('read request defaults to listing, all, most wanted and bounded page size', () => {
  assert.deepEqual(normalizePeekThreadReadRequest({ parentId: PARENT_ID }), {
    parentType: 'listing',
    parentId: PARENT_ID,
    filter: 'all',
    sort: 'most_wanted',
    limit: 20,
    cursor: null,
  });
});

test('read request accepts service parent and clamps oversized limits', () => {
  const request = normalizePeekThreadReadRequest({
    parentType: 'service', parentId: PARENT_ID, filter: 'pending', sort: 'newest', limit: 500,
  });
  assert.equal(request.parentType, 'service');
  assert.equal(request.limit, PEEK_THREAD_MAX_PAGE_SIZE);
});

test('invalid filters and sorts fail safely to public defaults', () => {
  const request = normalizePeekThreadReadRequest({ parentId: PARENT_ID, filter: 'removed', sort: 'random' });
  assert.equal(request.filter, 'all');
  assert.equal(request.sort, 'most_wanted');
});

test('cursor is normalized for deterministic keyset reads', () => {
  const request = normalizePeekThreadReadRequest({
    parentId: PARENT_ID,
    cursor: { supporterCount: 12.9, createdAt: '2026-08-04T00:00:00Z', id: CURSOR_ID },
  });
  assert.deepEqual(request.cursor, {
    supporterCount: 12,
    createdAt: '2026-08-04T00:00:00.000Z',
    id: CURSOR_ID,
  });
});

test('page mapper never exposes requester identity', () => {
  const page = normalizePeekThreadPage([{
    request_id: CURSOR_ID,
    listing_id: PARENT_ID,
    service_id: null,
    category: 'condition',
    body: 'Show the rear tyres closely',
    status: 'pending',
    supporter_count: 7,
    requested_by_label: 'a buyer',
    requester_id: '33333333-3333-4333-8333-333333333333',
    created_at: '2026-08-04T00:00:00Z',
    answered_at: null,
    current_response_id: null,
    next_supporter_count: null,
    next_created_at: null,
    next_id: null,
  }], 20);
  assert.equal(page.items[0].requestedByLabel, 'a buyer');
  assert.equal('requesterId' in page.items[0], false);
});

test('migration keeps playback explicit and supports all required views', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/0118_peek_thread_read_api.sql', import.meta.url), 'utf8');
  assert.match(sql, /p_filter not in \('all', 'answered', 'pending'\)/);
  assert.match(sql, /p_sort not in \('most_wanted', 'newest'\)/);
  assert.match(sql, /limit v_limit \+ 1/);
  assert.match(sql, /current_response_id/);
  assert.doesNotMatch(sql, /playback_url/i);
  assert.doesNotMatch(sql, /requester_id[\s,]+.*returns table/is);
});
