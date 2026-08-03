import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/**
 * Executes public/sw.js against mocked worker globals and asserts which
 * requests it chooses to handle.
 *
 * This is the security test for the PWA work. The worker's entire protection
 * against caching authenticated data is "only same-origin GET, and never
 * anything credential-bearing". Asserting that in a comment is worthless; this
 * runs the real fetch handler and checks whether respondWith was called.
 */

const ORIGIN = 'https://findit.example';
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
    /** @returns {boolean} whether the worker took over the request */
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

// --- The boundary that keeps user data out of the cache ---------------------

test('cross-origin Supabase requests are never handled', () => {
  assert.equal(
    worker.handles(get('https://abc123.supabase.co/rest/v1/listings?select=*')),
    false,
    'PostgREST rows must never reach a cache',
  );
  assert.equal(
    worker.handles(get('https://abc123.supabase.co/storage/v1/object/sign/listing-images/x.jpg?token=ey')),
    false,
    'signed storage URLs must never reach a cache',
  );
  assert.equal(
    worker.handles(get('https://abc123.supabase.co/functions/v1/reveal-contact')),
    false,
    'Edge Function responses must never reach a cache',
  );
});

test('other third-party origins are left alone', () => {
  assert.equal(worker.handles(get('https://api.maptiler.com/tiles/1/2/3.png')), false);
  assert.equal(worker.handles(get('https://accounts.google.com/o/oauth2/auth')), false);
});

test('same-origin requests carrying credentials are not handled', () => {
  assert.equal(
    worker.handles(get(`${ORIGIN}/api/whatever`, { headers: { Authorization: 'Bearer token' } })),
    false,
    'an Authorization header disqualifies a request',
  );
  assert.equal(
    worker.handles(get(`${ORIGIN}/api/whatever`, { headers: { apikey: 'anon-key' } })),
    false,
    'an apikey header disqualifies a request',
  );
  assert.equal(
    worker.handles(get(`${ORIGIN}/download?token=secret-value`)),
    false,
    'a token query parameter disqualifies a request',
  );
});

test('non-GET methods are never handled', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(
      worker.handles(new Request(`${ORIGIN}/assets/index.abcdef123.js`, { method })),
      false,
      `${method} must pass through`,
    );
  }
});

// --- What the worker is supposed to serve -----------------------------------

test('navigations are handled so a browser error page is never shown', () => {
  const navigation = new Request(`${ORIGIN}/search?type=property`, { method: 'GET' });
  Object.defineProperty(navigation, 'mode', { value: 'navigate' });
  assert.equal(worker.handles(navigation), true);
});

test('content-hashed build assets are handled', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/assets/index-CAaKOM3W.js`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/index-BJRbtusx.css`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/findit-icon-192-DK6jIokt.png`)), true);
});

test('brand assets and the manifest are handled', () => {
  assert.equal(worker.handles(get(`${ORIGIN}/brand/findit-icon-192.png`)), true);
  assert.equal(worker.handles(get(`${ORIGIN}/manifest.webmanifest`)), true);
});

test('unrecognised same-origin paths fall through to the network', () => {
  // The default is "do not handle". A new same-origin route is not silently
  // cached just because it is same-origin.
  assert.equal(worker.handles(get(`${ORIGIN}/some/future/api/route`)), false);
  // An un-hashed asset is not cached indefinitely, because nothing guarantees
  // its URL changes when its content does.
  //
  // Note the fixture: it cannot contain a hyphen followed by eight-plus
  // characters, because Vite hashes may themselves contain hyphens -- the real
  // build emits `findit-icon-32-Dv-RmQFK.png`, hash `Dv-RmQFK`. A name like
  // `not-content-hashed.js` is genuinely indistinguishable from a hashed one.
  assert.equal(worker.handles(get(`${ORIGIN}/assets/vendor.js`)), false);
  assert.equal(worker.handles(get(`${ORIGIN}/assets/styles.css`)), false);
});

// --- Versioning -------------------------------------------------------------

test('the worker source carries a version placeholder for build stamping', () => {
  assert.ok(
    workerSource.includes('__SW_VERSION__'),
    'scripts/stamp-service-worker.mjs replaces this at build time; without it '
    + 'cache invalidation never happens',
  );
});

test('cache names are derived from the version so a deploy rotates them', () => {
  assert.ok(/const SHELL_CACHE = `findit-shell-\$\{VERSION\}`/.test(workerSource));
  assert.ok(/const ASSET_CACHE = `findit-assets-\$\{VERSION\}`/.test(workerSource));
});

test('the worker does not call skipWaiting outside an explicit message', () => {
  // An unconditional skipWaiting() would swap the app out from under a seller
  // mid-listing. It must only happen when the page asks (§17).
  const installBody = workerSource
    .slice(
      workerSource.indexOf("addEventListener('install'"),
      workerSource.indexOf("addEventListener('activate'"),
    )
    // Strip comments first: the handler documents *why* it does not call
    // skipWaiting, and matching that prose would fail the test for the very
    // reason it is meant to pass.
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!installBody.includes('skipWaiting'), 'install must not self-activate');
  assert.ok(
    workerSource.includes("event.data?.type === 'SKIP_WAITING'"),
    'activation must be message-driven',
  );
});
