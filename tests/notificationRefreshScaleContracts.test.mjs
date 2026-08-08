import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [page, repository, service, unreadHook] = await Promise.all([
  read('src/pages/NotificationCenter.jsx'),
  read('src/repositories/notificationsRepository.js'),
  read('src/services/notificationsService.js'),
  read('src/hooks/useUnreadAlerts.js'),
]);

const historyStart = page.indexOf('const notificationsQuery = useInfiniteQuery({');
const tailStart = page.indexOf('const tailQuery = useQuery({');
const unreadStart = page.indexOf('const unreadQuery = useQuery({');
assert.notEqual(historyStart, -1);
assert.notEqual(tailStart, -1);
assert.notEqual(unreadStart, -1);
const historyBlock = page.slice(historyStart, tailStart);
const tailBlock = page.slice(tailStart, unreadStart);

test('loaded notification history is immutable and never attached to polling', () => {
  assert.match(historyBlock, /queryFn: \(\{ pageParam, signal \}\) => getNotificationsPage\(\{ \.\.\.request, cursor: pageParam \|\| null \}, signal\)/);
  assert.match(historyBlock, /staleTime: Infinity/);
  assert.match(historyBlock, /refetchOnWindowFocus: false/);
  assert.match(historyBlock, /refetchOnReconnect: false/);
  assert.doesNotMatch(historyBlock, /refetchInterval/);
});

test('only a bounded latest notification page performs periodic refreshes', () => {
  assert.match(tailBlock, /queryKey: tailKey/);
  assert.match(tailBlock, /getNotificationsPage\(request, signal\)/);
  assert.match(tailBlock, /refetchInterval: NOTIFICATION_REFRESH_MS/);
  assert.match(page, /const PAGE_SIZE = 50/);
  assert.match(page, /for \(const item of tailQuery\.data\?\.items \|\| \[\]\) byId\.set\(item\.id, item\)/);
  assert.match(page, /if \(!byId\.has\(item\.id\)\) byId\.set\(item\.id, item\)/);
});

test('tail refreshes rebase safely when history is empty or loses overlap', () => {
  assert.match(page, /if \(!historyItems\.length\) \{/);
  assert.match(page, /const overlaps = incomingItems\.some\(\(item\) => historyIds\.has\(item\.id\)\)/);
  assert.match(page, /if \(overlaps\) return/);
  const rebaseCount = page.match(/pages: \[tailQuery\.data\],[\s\S]{0,80}pageParams: \[null\]/g) ?? [];
  assert.equal(rebaseCount.length, 2);
});

test('notification reads propagate TanStack cancellation through repository and service layers', () => {
  assert.match(repository, /function rpc\(name, parameters, message, signal\)/);
  assert.match(repository, /if \(signal\) query = query\.abortSignal\(signal\)/);
  assert.match(repository, /findNotificationsPage\(request, signal\)/);
  assert.match(repository, /fetchUnreadNotificationCount\(signal\)/);
  assert.match(service, /getNotificationsPage\(input = \{\}, signal\)/);
  assert.match(service, /await findNotificationsPage\(request, signal\)/);
  assert.match(service, /throwIfAborted\(signal\)/);
  assert.match(service, /getUnreadNotificationCount\(signal\)/);
  assert.match(unreadHook, /queryFn: \(\{ signal \}\) => getUnreadNotificationCount\(signal\)/);
});

test('read mutations update bounded local caches instead of refetching loaded history', () => {
  assert.match(page, /const updateReadCaches = \(notificationId = null\) =>/);
  assert.match(page, /getQueryData\(historyKey\)/);
  assert.match(page, /getQueryData\(tailKey\)/);
  assert.match(page, /setQueryData\(unreadKey, notificationId \? Math\.max\(0, currentUnread - 1\) : 0\)/);
  assert.doesNotMatch(page, /invalidateQueries/);
  assert.match(page, /notificationsQuery\.isFetchNextPageError/);
  assert.match(page, /onClick=\{\(\) => notificationsQuery\.fetchNextPage\(\)\}>Retry loading more/);
});
