/* FindIt service worker.
 *
 * Hand-written rather than generated. Workbox would be a new dependency and a
 * build-pipeline change, and the caching rules here are short enough to read in
 * one sitting -- which matters, because the security boundary lives in them.
 *
 * ---------------------------------------------------------------------------
 * SECURITY BOUNDARY -- read before changing any of this
 * ---------------------------------------------------------------------------
 * The worker handles ONLY same-origin GET requests. Everything else is left
 * entirely alone: no respondWith, no cache read, no cache write. That single
 * rule is what keeps authenticated data out of the cache, because every piece
 * of user data in this application is fetched cross-origin from Supabase:
 *
 *   - PostgREST rows (listings, messages, profiles)  -> *.supabase.co
 *   - Signed storage URLs for private media          -> *.supabase.co
 *   - Edge Function responses                        -> *.supabase.co
 *
 * None of those are same-origin, so none can reach a cache here. A future
 * same-origin API would NOT get that protection automatically, so the
 * navigation and asset handlers below also refuse anything carrying an
 * Authorization header or a Set-Cookie response.
 *
 * The consequence worth stating plainly: offline support covers the shell and
 * static assets. Cached *user data* is deliberately left to the application
 * layer (IndexedDB via the app), where it can be scoped to an account and
 * cleared on sign-out. A shared HTTP cache cannot do either.
 */

const VERSION = '__SW_VERSION__';
const SHELL_CACHE = `findit-shell-${VERSION}`;
const ASSET_CACHE = `findit-assets-${VERSION}`;
const OWNED_CACHES = new Set([SHELL_CACHE, ASSET_CACHE]);

const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';

// Kept small on purpose: everything else is content-hashed and cached at
// runtime on first use, so a deploy never invalidates more than it must.
const PRECACHE_URLS = [
  SHELL_URL,
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/brand/findit-icon-192.png',
  '/brand/findit-icon-512.png',
  '/brand/findit-maskable-512.png',
];

// Content-hashed build output. Safe to cache indefinitely: a new build emits a
// new filename, so a stale entry can never shadow fresh code.
//
// Vite separates the hash with a HYPHEN, not a dot -- `index-CAaKOM3W.js`,
// `findit-icon-192-DK6jIokt.png`. An earlier version of this pattern expected
// `name.hash.ext` and therefore matched nothing at all, which would have left
// every asset uncached while the worker still looked healthy. Covered by
// tests/serviceWorkerBoundary.test.mjs against real emitted filenames.
const IMMUTABLE_PATH =
  /^\/assets\/[\w.-]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/;

const MAX_ASSET_ENTRIES = 220;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/** Requests that must never be served from, or written to, a cache. */
function isSensitive(request) {
  return request.headers.has('Authorization')
    || request.headers.has('apikey')
    || request.credentials === 'include'
    || new URL(request.url).search.includes('token=');
}

function isCacheableResponse(response) {
  return Boolean(response)
    && response.status === 200
    && response.type === 'basic'          // same-origin, not opaque
    && !response.headers.has('Set-Cookie'); // never cache a session-bearing reply
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Oldest-inserted first; Cache API preserves insertion order.
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll is atomic -- one 404 would leave the worker uninstalled and the
    // app permanently un-offline-able, so failures are tolerated per URL.
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (isCacheableResponse(response)) await cache.put(url, response);
      } catch {
        /* a shell asset missing at install time is recoverable at runtime */
      }
    }));
    // Deliberately NOT skipWaiting(): the page decides when to activate, so a
    // user mid-form is never swapped underneath. See src/lib/serviceWorker.js.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith('findit-') && !OWNED_CACHES.has(name))
        .map((name) => caches.delete(name)),
    );
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

// The page asks for activation once the user accepts the update prompt.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: VERSION });
  }
});

/**
 * Navigations: network first so a signed-in user always gets fresh HTML, with
 * the cached shell and then the offline page behind it. A browser error page is
 * never shown.
 */
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      const shell = await caches.open(SHELL_CACHE);
      if (isCacheableResponse(preloaded)) shell.put(SHELL_URL, preloaded.clone());
      return preloaded;
    }
    const response = await fetch(event.request);
    if (isCacheableResponse(response)) {
      const shell = await caches.open(SHELL_CACHE);
      shell.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>'
      + '<body style="font-family:system-ui;background:#050914;color:#fff;'
      + 'display:grid;place-items:center;height:100vh;margin:0">'
      + '<p>You are offline. Reconnect to continue.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/** Content-hashed assets: cache first, since the URL changes when they do. */
async function handleImmutableAsset(request) {
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
    trimCache(ASSET_CACHE, MAX_ASSET_ENTRIES);
  }
  return response;
}

/**
 * Other same-origin statics (icons, manifest, robots): stale-while-revalidate,
 * so they render instantly and refresh in the background.
 */
async function handleStatic(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (isCacheableResponse(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Everything below this line is deliberate: anything not matched here is
  // left to the network untouched, which is the safe default.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;   // Supabase, MapTiler, CDNs -- never cached
  if (isSensitive(request)) return; // belt and braces for same-origin APIs

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (IMMUTABLE_PATH.test(url.pathname)) {
    event.respondWith(handleImmutableAsset(request));
    return;
  }

  if (url.pathname.startsWith('/brand/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(handleStatic(request));
  }
});
