/**
 * Behavioural contract for the stamped service worker.
 *
 * scripts/stamp-service-worker.mjs prepends importScripts('/push-sw.js') to
 * dist/sw.js, so both files run in ONE ServiceWorkerGlobalScope. These tests
 * execute that composition and assert what a device actually does with a push
 * payload, rather than grepping the sources for expected substrings.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const ORIGIN = 'https://staging.peekalisting.com';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadWorker({ includePushScript = true } = {}) {
  const listeners = {};
  const shown = [];
  const navigated = [];
  const opened = [];
  const client = {
    url: `${ORIGIN}/`,
    focus: async () => {},
    navigate: async (url) => { navigated.push(url); },
  };

  const scope = {
    location: { hostname: 'staging.peekalisting.com', origin: ORIGIN },
    registration: {
      scope: `${ORIGIN}/`,
      navigationPreload: null,
      showNotification: async (title, options) => { shown.push({ title, ...options }); },
    },
    clients: {
      matchAll: async () => [client],
      claim: async () => {},
      openWindow: async (url) => { opened.push(url); },
    },
    skipWaiting: async () => {},
    addEventListener: (type, handler) => { (listeners[type] ||= []).push(handler); },
  };
  scope.self = scope;

  const context = vm.createContext({
    self: scope,
    caches: { keys: async () => [], open: async () => ({}), match: async () => null },
    fetch: async () => null,
    console,
    URL,
    Response: class {},
    Request: class {},
  });

  if (includePushScript) {
    vm.runInContext(await read('public/push-sw.js'), context, { filename: 'push-sw.js' });
  }
  const worker = (await read('public/sw.js')).replace("const VERSION = '__SW_VERSION__';", "const VERSION = 'test';");
  vm.runInContext(worker, context, { filename: 'sw.js' });

  const dispatch = async (type, event) => {
    const pending = [];
    for (const handler of listeners[type] || []) handler({ ...event, waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
  };

  return { listeners, shown, navigated, opened, dispatch };
}

const dispatcherPayload = {
  notificationId: '11111111-1111-4111-8111-111111111111',
  title: 'New message',
  body: 'You have a new message in PeekaListing.',
  link: '/chats/22222222-2222-4222-8222-222222222222',
  type: 'new_message',
  tag: 'peekalisting-11111111-1111-4111-8111-111111111111',
  timestamp: '2026-08-18T10:00:00.000Z',
};

test('the stamped worker registers exactly one push and one click handler', async () => {
  const { listeners } = await loadWorker();
  assert.equal(listeners.push.length, 1, 'a second push handler shows a competing notification');
  assert.equal(listeners.notificationclick.length, 1, 'a second click handler races routing to the wrong page');
});

test('push subscription lifecycle script never duplicates push rendering or routing', async () => {
  const push = await read('public/push-sw.js');
  assert.doesNotMatch(push, /addEventListener\('push'/);
  assert.doesNotMatch(push, /addEventListener\('notificationclick'/);
  assert.doesNotMatch(push, /showNotification/);
  assert.match(push, /addEventListener\('pushsubscriptionchange'/);
});

test('a delivered push shows one notification carrying a re-validatable link', async () => {
  const { shown, dispatch } = await loadWorker();
  await dispatch('push', { data: { json: () => dispatcherPayload } });

  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'New message');
  assert.equal(shown[0].data.link, dispatcherPayload.link, 'store the app path, not a resolved href');
  assert.equal(shown[0].data.notificationId, dispatcherPayload.notificationId);
});

test('clicking a delivered notification opens the deep link, not the fallback', async () => {
  const { shown, navigated, dispatch } = await loadWorker();
  await dispatch('push', { data: { json: () => dispatcherPayload } });
  await dispatch('notificationclick', { notification: { close: () => {}, data: shown[0].data } });

  assert.deepEqual(navigated, [`${ORIGIN}${dispatcherPayload.link}`]);
});

test('click routing stays same-origin and falls back safely', async () => {
  const cases = [
    ['/chats/22222222-2222-4222-8222-222222222222', `${ORIGIN}/chats/22222222-2222-4222-8222-222222222222`],
    // A notification left in the tray by an earlier build stored a resolved href.
    [`${ORIGIN}/chats/22222222-2222-4222-8222-222222222222`, `${ORIGIN}/chats/22222222-2222-4222-8222-222222222222`],
    ['https://evil.example/steal', `${ORIGIN}/notifications`],
    ['//evil.example/steal', `${ORIGIN}/notifications`],
    ['javascript:alert(1)', `${ORIGIN}/notifications`],
    [undefined, `${ORIGIN}/notifications`],
  ];

  for (const [link, expected] of cases) {
    const { navigated, dispatch } = await loadWorker();
    await dispatch('notificationclick', { notification: { close: () => {}, data: { link } } });
    assert.deepEqual(navigated, [expected], `link ${String(link)} routed incorrectly`);
  }
});

test('a malformed push payload still shows one user-visible notification', async () => {
  const { shown, dispatch } = await loadWorker();
  await dispatch('push', { data: { json: () => { throw new Error('not json'); } } });

  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'PeekaListing update');
  assert.equal(shown[0].silent, false);
});
