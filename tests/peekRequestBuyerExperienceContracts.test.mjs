import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PEEK_ACTIVITY_MAX_PAGE_SIZE,
  PEEK_ACTIVITY_PAGE_SIZE,
  normalizePeekActivityPage,
  normalizePeekActivityRequest,
} from '../src/domain/peekThreads/activityContracts.js';

const [repository, listingSurface, workspace, buyerQueue, migration] = await Promise.all([
  readFile(new URL('../src/repositories/peekThreadsRepository.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/peekThreads/PeekThreadsSection.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/BuyerPeekRequests.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/peekThreads/MyPeekRequestsQueue.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260808033000_peek_request_buyer_state_and_activity.sql', import.meta.url), 'utf8'),
]);

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

test('buyer activity requests are bounded and cursor-safe', () => {
  assert.equal(PEEK_ACTIVITY_PAGE_SIZE, 20);
  assert.equal(PEEK_ACTIVITY_MAX_PAGE_SIZE, 50);
  assert.deepEqual(normalizePeekActivityRequest({ limit: 500 }), { limit: 50, cursor: null });
  assert.deepEqual(normalizePeekActivityRequest({ limit: 0 }), { limit: 1, cursor: null });
  assert.deepEqual(normalizePeekActivityRequest({
    cursor: { createdAt: '2026-08-08T00:00:00Z', id: UUID_A },
  }), {
    limit: 20,
    cursor: { createdAt: '2026-08-08T00:00:00.000Z', id: UUID_A },
  });
});

test('buyer activity maps only caller-relative state and a bounded cursor', () => {
  const page = normalizePeekActivityPage([
    {
      request_id: UUID_A,
      parent_type: 'listing',
      parent_id: UUID_B,
      parent_kind: 'car',
      parent_title: 'Test car',
      parent_public: true,
      category: 'condition',
      body: 'Show the rear tyres closely',
      status: 'pending',
      supporter_count: 3,
      requested_by_me: false,
      supported_by_me: true,
      decline_reason: null,
      created_at: '2026-08-08T00:00:00Z',
      answered_at: null,
      current_response_id: null,
      next_created_at: '2026-08-07T23:00:00Z',
      next_id: UUID_B,
    },
  ], 20);

  assert.equal(page.items[0].requestedByMe, false);
  assert.equal(page.items[0].supportedByMe, true);
  assert.equal(page.items[0].supporterCount, 3);
  assert.deepEqual(page.nextCursor, { createdAt: '2026-08-07T23:00:00Z', id: UUID_B });
  assert.equal('requesterId' in page.items[0], false);
  assert.equal('supporterIds' in page.items[0], false);
});

test('active listing Peek Requests use v2, keyset paging and truthful interest controls', () => {
  assert.match(repository, /invoke\('peek_thread_page_v2'/);
  assert.match(listingSurface, /useInfiniteQuery/);
  assert.match(listingSurface, /getNextPageParam: \(page\) => page\.nextCursor \|\| undefined/);
  assert.match(listingSurface, /requestedByMe/);
  assert.match(listingSurface, /supportedByMe/);
  assert.match(listingSurface, /withdrawPeekRequestSupport/);
  assert.match(listingSurface, /Your request/);
  assert.match(listingSurface, /Interested/);
  assert.match(listingSurface, /I want this too/);
  assert.match(listingSurface, /Load more requests/);
});

test('Peek Requests workspace serves buyer tracking and seller fulfilment without a second route', () => {
  assert.match(workspace, /My requests/);
  assert.match(workspace, /Requests to answer/);
  assert.match(workspace, /MyPeekRequestsQueue/);
  assert.match(workspace, /BuyerPeekRequestsQueue/);
  assert.match(workspace, /searchParams\.get\('request'\)/);
  assert.match(buyerQueue, /getMyPeekRequestActivityPage/);
  assert.match(buyerQueue, /Response Peek available/);
  assert.match(buyerQueue, /Remove interest/);
  assert.match(buyerQueue, /Listing no longer public/);
});

test('buyer state migration preserves privacy, public-parent safety and bounded activity reads', () => {
  assert.match(migration, /private\.is_peek_parent_public/);
  assert.match(migration, /requested_by_me boolean/);
  assert.match(migration, /supported_by_me boolean/);
  assert.match(migration, /idx_peek_requests_requester_activity/);
  assert.match(migration, /my_peek_request_activity_page/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/);
  assert.doesNotMatch(
    migration.match(/returns table \([\s\S]*?\)\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = ''\nas \$function\$/)?.[0] || '',
    /requester_id uuid|user_id uuid/,
  );
});
