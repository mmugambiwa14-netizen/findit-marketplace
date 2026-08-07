import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  normalizePeekActivityPage,
  normalizePeekActivityRequest,
  PEEK_ACTIVITY_PAGE_SIZE,
} from '../src/domain/peekThreads/activityContracts.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, repository, readContracts, section, workspace, myQueue, certification] = await Promise.all([
  read('supabase/migrations/20260808033000_peek_request_buyer_state_and_activity.sql'),
  read('supabase/rollback/20260808033000_peek_request_buyer_state_and_activity.rollback.sql'),
  read('src/repositories/peekThreadsRepository.js'),
  read('src/domain/peekThreads/readContracts.js'),
  read('src/components/peekThreads/PeekThreadsSection.jsx'),
  read('src/pages/BuyerPeekRequests.jsx'),
  read('src/components/peekThreads/MyPeekRequestsQueue.jsx'),
  read('scripts/run-migration-database-certification.sh'),
]);

const UUID_A = '11111111-1111-4111-8111-111111111111';

test('Peek Request v2 restores the public-parent boundary and exposes caller state without identities', () => {
  assert.match(migration, /create or replace function private\.peek_thread_page_v2/);
  assert.match(migration, /private\.is_peek_parent_public\(p_listing_id, p_service_id\)/);
  assert.match(migration, /request\.status in \('pending', 'answered'\)/);
  assert.match(migration, /response\.status = 'published'/);
  assert.match(migration, /response\.moderation_status = 'approved'/);
  assert.match(migration, /requested_by_me boolean/);
  assert.match(migration, /supported_by_me boolean/);
  const resultBlock = migration.match(/create or replace function public\.peek_thread_page_v2[\s\S]*?language sql/)?.[0] || '';
  assert.doesNotMatch(resultBlock, /requester_id\s+uuid|user_id\s+uuid/);
});

test('legacy Peek Request reads remain compatible but delegate to the hardened v2 implementation', () => {
  const legacy = migration.match(/create or replace function private\.peek_thread_page\([\s\S]*?\$legacy\$;/)?.[0] || '';
  assert.match(legacy, /private\.peek_thread_page_v2/);
  assert.match(legacy, /security definer/);
  assert.match(legacy, /set search_path = ''/);
  assert.match(migration, /grant execute on function public\.peek_thread_page[\s\S]*to anon, authenticated, service_role/);
  assert.doesNotMatch(rollback, /drop function if exists private\.peek_thread_page_v2/);
});

test('active listing feed calls v2 and maps requested/support state', () => {
  assert.match(repository, /invoke\('peek_thread_page_v2'/);
  assert.doesNotMatch(repository, /invoke\('peek_thread_page',/);
  assert.match(readContracts, /requestedByMe: Boolean\(row\.requested_by_me\)/);
  assert.match(readContracts, /supportedByMe: Boolean\(row\.supported_by_me\)/);
});

test('listing Peek Requests use bounded infinite pages and foreground freshness', () => {
  assert.match(section, /useInfiniteQuery/);
  assert.match(section, /getNextPageParam: \(page\) => page\.nextCursor/);
  assert.match(section, /limit: 20/);
  assert.match(section, /const REQUEST_REFRESH_MS = 30_000/);
  assert.match(section, /refetchIntervalInBackground: false/);
  assert.match(section, /refetchOnWindowFocus: 'always'/);
  assert.match(section, /Load more requests/);
});

test('buyer support controls distinguish own, supported and unsupported requests', () => {
  assert.match(section, /Your request/);
  assert.match(section, /aria-pressed=\{item\.supportedByMe\}/);
  assert.match(section, /item\.supportedByMe \? 'Interested' : 'I want this too'/);
  assert.match(section, /supported: item\.supportedByMe/);
  assert.match(section, /withdrawPeekRequestSupport/);
  assert.match(section, /A similar Peek Request is already answered/);
  assert.match(section, /You are already part of this Peek Request/);
});

test('buyer activity contract is bounded and maps safe relationship state', () => {
  const request = normalizePeekActivityRequest({ limit: 500, cursor: { createdAt: '2026-08-08T00:00:00Z', id: UUID_A } });
  assert.equal(request.limit, 50);
  assert.deepEqual(request.cursor, { createdAt: '2026-08-08T00:00:00.000Z', id: UUID_A });
  assert.equal(normalizePeekActivityRequest({}).limit, PEEK_ACTIVITY_PAGE_SIZE);

  const page = normalizePeekActivityPage([{
    request_id: UUID_A,
    parent_type: 'listing',
    parent_id: UUID_A,
    parent_kind: 'property',
    parent_title: 'Example listing',
    parent_public: true,
    category: 'condition',
    body: 'Show the roof condition',
    status: 'pending',
    supporter_count: 3,
    requested_by_me: false,
    supported_by_me: true,
    decline_reason: null,
    created_at: '2026-08-08T00:00:00Z',
    answered_at: null,
    current_response_id: null,
    next_created_at: '2026-08-07T23:00:00Z',
    next_id: UUID_A,
  }]);
  assert.equal(page.items[0].supportedByMe, true);
  assert.equal(page.items[0].requestedByMe, false);
  assert.equal(page.items[0].parentPublic, true);
  assert.deepEqual(page.nextCursor, { createdAt: '2026-08-07T23:00:00Z', id: UUID_A });
});

test('Peek Requests workspace separates buyer tracking from seller fulfilment', () => {
  assert.match(workspace, />My requests</);
  assert.match(workspace, />Requests to answer</);
  assert.match(workspace, /requestedResponse \|\| searchParams\.get\('view'\) === 'answer'/);
  assert.match(workspace, /<MyPeekRequestsQueue \/>/);
  assert.match(workspace, /<ResponsePeekBindingQueue \/>/);
  assert.match(workspace, /<BuyerPeekRequestsQueue \/>/);
});

test('My requests supports keyset activity, response playback and pending interest withdrawal', () => {
  assert.match(myQueue, /getMyPeekRequestActivityPage/);
  assert.match(myQueue, /useInfiniteQuery/);
  assert.match(myQueue, /getNextPageParam: \(page\) => page\.nextCursor/);
  assert.match(myQueue, /const ACTIVITY_REFRESH_MS = 30_000/);
  assert.match(myQueue, /withdrawPeekRequestSupport/);
  assert.match(myQueue, /Remove interest/);
  assert.match(myQueue, /ResponsePeekWatchButton/);
  assert.match(myQueue, /Listing no longer public/);
});

test('clean database certification includes the buyer-state pgTAP suite', () => {
  assert.match(certification, /v1_peek_request_buyer_state_and_activity\.sql/);
});
