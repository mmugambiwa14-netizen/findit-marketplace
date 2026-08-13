import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ORIGIN = 'https://peekalisting.example';
const workerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sw.js'),
  'utf8',
);

function loadWorker() {
  const listeners = new Map();
  const cacheStore = new Map();
  const fakeCache = {
    async match() { return undefined; },
    async put() {},
    async keys() { return []; },
    async delete() { return true; },
  };
  const context = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type, handler) => listeners.set(type, handler),
      registration: { navigationPreload: null },
      clients: { claim: async () => {} },
      skipWaiting: () => {},
    },
    caches: {
      open: async (name) => { cacheStore.set(name, fakeCache); return fakeCache; },
      keys: async () => [...cacheStore.keys()],
      delete: async () => true,
      match: async () => undefined,
    },
    fetch: async () => new Response('ok', { status: 200 }),
    importScripts: () => {},
    Request,
    Response,
    Headers,
    URL,
    console,
  };
  context.self.caches = context.caches;
  vm.createContext(context);
  vm.runInContext(workerSource, context);

  return {
    handles(request) {
      let handled = false;
      const event = {
        request,
        preloadResponse: Promise.resolve(undefined),
        respondWith: () => { handled = true; },
        waitUntil: () => {},
      };
      listeners.get('fetch')(event);
      return handled;
    },
  };
}

const worker = loadWorker();
const get = (url, init = {}) => new Request(url, { method: 'GET', ...init });

test('cross-origin Supabase requests are never handled', () => {
  assert.equal(worker.handles(get('https://abc123.supabase.co/rest/v1/listings?select=*')), false);
  assert.equal(worker.handles(get('https://abc123.supabase.co/storage/v1/object/sign/listing-images/x.jpg?token=ey')), false);
  assert.equal(worker.handles(get('https://abc123.supabase.co/functions/v1/reveal-contact')), false);
});

test('other third-party origins are left alone', () => {
  assert.equal(worker.handles(get('https://api.maptiler.com/tiles/1/2/3.png')), false);
  assert.equal(worker.handles(get('https://accounts.google.com/o/oauth2/auth')), false);
});

test('same-origin requests carrying credentials are not handled', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/api/whatever`, { headers: { Authorization: 'Bearer token' } })), false);
  assert.equal(worker.handles(get(`${ORIGIN}/api/whatever`, { headers: { apikey: 'anon-key' } })), false);
  assert.equal(worker.handles(get(`${ORIGIN}/download?token=secret-value`)), false);
});

test('non-GET methods are never handled', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(worker.handles(new Request(`${ORIGIN}/assets/index.abcdef123.js`, { method })), false);
  }
});

test('navigations are handled so a browser error page is never shown', () => {
  const navigation = new Request(`${ORIGIN}/search?type=property`, { method: 'GET' });
  Object.defineProperty(navigation, 'mode', { value: 'navigate' });
  assert.equal(worker.handles(navigation), true);
});

test('content-hashed build assets are handled', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/assets/index-CAaKOM3W.js`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/index-BJRbtusx.css`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/peekalisting-icon-DK6jIokt.svg`)), true);
});

test('brand assets and the manifest are handled', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/brand/peekalisting-binoculars.svg`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/manifest.webmanifest`)), true);
});

test('unrecognised same-origin paths fall through to the network', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/some/future/api/route`)), false);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/vendor.js`)), false);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/styles.css`)), false);
});

test('the worker source carries a version placeholder for build stamping', () => {
  assert.ok(workerSource.includes('__SW_VERSION__'));
});

test('cache names are derived from the version and old FindIt caches are retired', () => {
  assert.ok(/const SHELL_CACHE = `peekalisting-shell-\$\{VERSION\}`/.test(workerSource));
  assert.ok(/const ASSET_CACHE = `peekalisting-assets-\$\{VERSION\}`/.test(workerSource));
  assert.match(workerSource, /name\.startsWith\('findit-'\)/);
});

test('the worker does not call skipWaiting outside an explicit message', () => {
  const installBody = workerSource
    .slice(workerSource.indexOf("addEventListener('install'"), workerSource.indexOf("addEventListener('activate'"))
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!installBody.includes('skipWaiting'));
  assert.ok(workerSource.includes("event.data?.type === 'SKIP_WAITING'"));
});
