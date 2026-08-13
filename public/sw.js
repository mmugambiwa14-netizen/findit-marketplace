importScripts('/push-sw.js');

/* PeekaListing service worker.
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
 * of user data in this application is fetched cross-origin from Supabase.
 */

const VERSION = '__SW_VERSION__';
const SHELL_CACHE = `peekalisting-shell-${VERSION}`;
const ASSET_CACHE = `peekalisting-assets-${VERSION}`;
const OWNED_CACHES = new Set([SHELL_CACHE, ASSET_CACHE]);

const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';

const PRECACHE_URLS = [
  SHELL_URL,
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/brand/peekalisting-binoculars.svg',
];

const IMMUTABLE_PATH =
  /^\/assets\/[\w.-]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/;

const MAX_ASSET_ENTRIES = 220;

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSensitive(request) {
  return request.headers.has('Authorization')
    || request.headers.has('apikey')
    || request.credentials === 'include'
    || new URL(request.url).search.includes('token=');
}

function isCacheableResponse(response) {
  return Boolean(response)
    && response.status === 200
    && response.type === 'basic'
    && !response.headers.has('Set-Cookie');
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (isCacheableResponse(response)) await cache.put(url, response);
      } catch {
        /* a shell asset missing at install time is recoverable at runtime */
      }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => (
          (name.startsWith('peekalisting-') || name.startsWith('findit-'))
          && !OWNED_CACHES.has(name)
        ))
        .map((name) => caches.delete(name)),
    );
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: VERSION });
  }
});

async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      const shell = await caches.open(SHELL_CACHE);
      if (isCacheableResponse(preloaded)) await shell.put(SHELL_URL, preloaded.clone());
      return preloaded;
    }
    const response = await fetch(event.request);
    if (isCacheableResponse(response)) {
      const shell = await caches.open(SHELL_CACHE);
      await shell.put(SHELL_URL, response.clone());
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

async function handleImmutableAsset(request) {
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
    await trimCache(ASSET_CACHE, MAX_ASSET_ENTRIES);
  }
  return response;
}

async function handleStatic(event) {
  const { request } = event;
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Preserve stale-while-revalidate without letting the worker terminate
    // before the background cache write completes.
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;
  if (isSensitive(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (IMMUTABLE_PATH.test(url.pathname)) {
    event.respondWith(handleImmutableAsset(request));
    return;
  }

  if (url.pathname.startsWith('/brand/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(handleStatic(event));
  }
});
