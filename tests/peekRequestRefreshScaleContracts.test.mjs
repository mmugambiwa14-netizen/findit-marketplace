import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  buyerActivity,
  sellerQueue,
  sellerLive,
  bindingQueue,
  repository,
  service,
  sellerQueueSql,
  bindingSql,
] = await Promise.all([
  read('src/components/peekThreads/MyPeekRequestsQueue.jsx'),
  read('src/components/peekThreads/BuyerPeekRequestsQueue.jsx'),
  read('src/components/peekThreads/SellerPeekRequestsQueueLive.jsx'),
  read('src/components/peekThreads/ResponsePeekBindingQueue.jsx'),
  read('src/repositories/peekThreadsRepository.js'),
  read('src/services/peekThreadsService.js'),
  read('supabase/migrations/20260807020500_peek_fulfilment_seller_queue.sql'),
  read('supabase/migrations/0123_response_peek_binding_and_notifications.sql'),
]);

function queryBlock(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.notEqual(start, -1, `missing ${startText}`);
  assert.notEqual(end, -1, `missing ${endText}`);
  return source.slice(start, end);
}

test('buyer Peek Request history is immutable while only the latest 20 rows poll', () => {
  const history = queryBlock(buyerActivity, 'const activity = useInfiniteQuery({', 'const tail = useQuery({');
  const tail = queryBlock(buyerActivity, 'const tail = useQuery({', 'useEffect(() => {');
  assert.match(buyerActivity, /const ACTIVITY_PAGE_SIZE = 20/);
  assert.match(history, /pageParam, signal/);
  assert.match(history, /staleTime: Infinity/);
  assert.match(history, /refetchOnWindowFocus: false/);
  assert.match(history, /refetchOnReconnect: false/);
  assert.doesNotMatch(history, /refetchInterval/);
  assert.match(tail, /getMyPeekRequestActivityPage\(\{ limit: ACTIVITY_PAGE_SIZE \}, signal\)/);
  assert.match(tail, /refetchInterval: ACTIVITY_REFRESH_MS/);
  assert.match(buyerActivity, /const overlaps = incomingItems\.some\(\(item\) => historyIds\.has\(item\.requestId\)\)/);
  assert.match(buyerActivity, /pages: \[tail\.data\], pageParams: \[null\]/);
});

test('buyer withdraw updates local activity caches instead of refetching loaded history', () => {
  assert.match(buyerActivity, /removeRequestFromCaches\(requestId\)/);
  assert.match(buyerActivity, /invalidateQueries\(\{ queryKey: tailKey, exact: true \}\)/);
  assert.doesNotMatch(buyerActivity, /invalidateQueries\(\{ queryKey: \['peek-request-activity'\] \}\)/);
  assert.match(buyerActivity, /activity\.isFetchNextPageError/);
});

test('seller Peek Request history is immutable and latest-20 tail owns periodic freshness', () => {
  const history = queryBlock(sellerQueue, 'const queue = useInfiniteQuery({', 'const tail = useQuery({');
  const tail = queryBlock(sellerQueue, 'const tail = useQuery({', 'useEffect(() => {');
  assert.match(sellerQueue, /const SELLER_QUEUE_PAGE_SIZE = 20/);
  assert.match(history, /pageParam, signal/);
  assert.match(history, /staleTime: Infinity/);
  assert.match(history, /refetchOnWindowFocus: false/);
  assert.match(history, /refetchOnReconnect: false/);
  assert.doesNotMatch(history, /refetchInterval/);
  assert.match(tail, /getSellerPeekRequestQueue\(\{ limit: SELLER_QUEUE_PAGE_SIZE \}, signal\)/);
  assert.match(tail, /refetchInterval: SELLER_QUEUE_REFRESH_MS/);
  assert.match(sellerQueue, /const overlaps = incomingItems\.some\(\(item\) => historyIds\.has\(item\.requestId\)\)/);
  assert.match(sellerQueue, /pages: \[tail\.data\], pageParams: \[null\]/);
});

test('seller mutations stay local and the old broad refresh wrapper is gone', () => {
  assert.match(sellerQueue, /const updateQueueCaches = \(requestId, updater\) =>/);
  assert.match(sellerQueue, /invalidateQueries\(\{ queryKey: tailKey, exact: true \}\)/);
  assert.doesNotMatch(sellerQueue, /invalidateQueries\(\{ queryKey: \['seller-peek-request-queue'\] \}\)/);
  assert.doesNotMatch(sellerLive, /invalidateQueries|setInterval|visibilitychange|online/);
  assert.match(sellerLive, /return <BuyerPeekRequestsQueue \/>/);
});

test('seller request deep links cannot silently page through an unbounded queue', () => {
  assert.match(sellerQueue, /const MAX_REQUESTED_AUTO_PAGES = 5/);
  assert.match(sellerQueue, /requestedAutoPagesRef\.current < MAX_REQUESTED_AUTO_PAGES/);
  assert.match(sellerQueue, /requestedAutoPagesRef\.current \+= 1/);
  assert.match(sellerQueue, /queue\.isFetchNextPageError/);
});

test('Peek Request reads propagate cancellation from TanStack through service and repository', () => {
  assert.match(repository, /async function invoke\(name, args, message, signal\)/);
  assert.match(repository, /if \(signal\) query = query\.abortSignal\(signal\)/);
  assert.match(repository, /readMyPeekRequestActivityPage\(request, signal\)/);
  assert.match(repository, /readSellerPeekRequestQueue\(request, signal\)/);
  assert.match(repository, /readUnboundResponsePeeks\(signal\)/);
  assert.match(repository, /readResponsePeekRequestCandidates\(tourId, signal\)/);
  assert.match(service, /function throwIfAborted\(signal\)/);
  assert.match(service, /getMyPeekRequestActivityPage\(input = \{\}, signal\)/);
  assert.match(service, /getSellerPeekRequestQueue\(input = \{\}, signal\)/);
  assert.match(service, /getUnboundResponsePeeks\(signal\)/);
  assert.match(service, /getResponsePeekRequestCandidates\(tourId, signal\)/);
  assert.match(bindingQueue, /queryFn: \(\{ signal \}\) => getUnboundResponsePeeks\(signal\)/);
  assert.match(bindingQueue, /queryFn: \(\{ signal \}\) => getResponsePeekRequestCandidates\(active\.tourId, signal\)/);
});

test('Response Peek binding refreshes only server-bounded lists and does not wake notification history', () => {
  const unboundStart = bindingSql.indexOf('create or replace function public.seller_unbound_response_peeks()');
  const candidatesStart = bindingSql.indexOf('create or replace function public.response_peek_request_candidates', unboundStart);
  const bindStart = bindingSql.indexOf('create or replace function public.bind_response_peek(', candidatesStart);
  assert.notEqual(unboundStart, -1);
  assert.notEqual(candidatesStart, -1);
  assert.notEqual(bindStart, -1);
  const unbound = bindingSql.slice(unboundStart, candidatesStart);
  const candidates = bindingSql.slice(candidatesStart, bindStart);
  assert.match(unbound, /limit 50/);
  assert.match(candidates, /limit 100/);
  assert.match(bindingQueue, /refetchInterval: READY_RESPONSE_REFRESH_MS/);
  assert.match(bindingQueue, /invalidateQueries\(\{ queryKey: \['seller-peek-request-queue', accountId, 'tail'\], exact: true \}\)/);
  assert.doesNotMatch(bindingQueue, /invalidateQueries\(\{ queryKey: \['notifications'\]/);
});

test('seller queue remains bounded keyset pagination at the database boundary', () => {
  assert.match(sellerQueueSql, /v_limit integer := least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/);
  assert.match(sellerQueueSql, /o\.queue_score < p_cursor_score/);
  assert.match(sellerQueueSql, /o\.created_at > p_cursor_created_at/);
  assert.match(sellerQueueSql, /o\.id > p_cursor_id/);
  assert.match(sellerQueueSql, /limit v_limit \+ 1/);
  assert.doesNotMatch(queryBlock(sellerQueueSql, 'eligible as (', 'cursor_row as ('), /\boffset\b/i);
});
