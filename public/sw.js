/* PeekaListing service worker.
 *
 * Hand-written rather than generated. Workbox would be a new dependency and a
 * build-pipeline change, and the caching rules here are short enough to audit.
 *
 * SECURITY BOUNDARY
 * The fetch worker handles ONLY same-origin GET requests. Authenticated data is
 * cross-origin from Supabase and is never cached here. Push handling below only
 * renders a conservative payload and opens validated same-origin app routes.
 */

const VERSION = '__SW_VERSION__';
const SHELL_CACHE = `peekalisting-shell-${VERSION}`;
const ASSET_CACHE = `peekalisting-assets-${VERSION}`;
const OWNED_CACHES = new Set([SHELL_CACHE, ASSET_CACHE]);
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';
const PRECACHE_URLS = [SHELL_URL, OFFLINE_URL, '/manifest.webmanifest', '/brand/peekalisting-binoculars.svg'];
const IMMUTABLE_PATH = /^\/assets\/[\w.-]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/;
const MAX_ASSET_ENTRIES = 220;

function isSameOrigin(url) { return url.origin === self.location.origin; }
function isSensitive(request) {
  return request.headers.has('Authorization')
    || request.headers.has('apikey')
    || request.credentials === 'include'
    || new URL(request.url).search.includes('token=');
}
function isCacheableResponse(response) {
  return Boolean(response) && response.status === 200 && response.type === 'basic' && !response.headers.has('Set-Cookie');
}
function safeText(value, fallback, max) {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  return (text || fallback).slice(0, max);
}
function safeAppUrl(path) {
  const candidate = typeof path === 'string' ? path.trim() : '';
  const safePath = candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('://')
    ? candidate
    : '/notifications';
  const scope = new URL(self.registration.scope);
  const basePath = scope.pathname.endsWith('/') ? scope.pathname.slice(0, -1) : scope.pathname;
  const normalized = safePath === '/' ? '' : safePath;
  return new URL(`${basePath}${normalized}` || '/', scope.origin).href;
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
    await Promise.all(names
      .filter((name) => ((name.startsWith('peekalisting-') || name.startsWith('findit-')) && !OWNED_CACHES.has(name)))
      .map((name) => caches.delete(name)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports?.[0]?.postMessage({ version: VERSION });
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json?.() ?? {}; } catch { payload = {}; }
    const notificationId = safeText(payload.notificationId, '', 128);
    const title = safeText(payload.title, 'PeekaListing update', 120);
    const body = safeText(payload.body, 'You have a new PeekaListing notification.', 220);
    const link = typeof payload.link === 'string' ? payload.link : '/notifications';
    const tag = safeText(payload.tag, notificationId ? `peekalisting-${notificationId}` : 'peekalisting-update', 160);
    await self.registration.showNotification(title, {
      body,
      icon: '/brand/peekalisting-binoculars.svg',
      badge: '/brand/peekalisting-binoculars.svg',
      tag,
      renotify: false,
      silent: false,
      timestamp: Number(new Date(payload.timestamp || Date.now())) || Date.now(),
      data: { notificationId, link: safeAppUrl(link), type: safeText(payload.type, 'account_update', 80) },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeAppUrl(event.notification?.data?.link || '/notifications');
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ('navigate' in client) await client.navigate(target);
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});

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
    return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;background:#050914;color:#fff;display:grid;place-items:center;height:100vh;margin:0"><p>You are offline. Reconnect to continue.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

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

async function handleStatic(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (isCacheableResponse(response)) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isSameOrigin(url) || isSensitive(request)) return;
  if (request.mode === 'navigate') { event.respondWith(handleNavigation(event)); return; }
  if (IMMUTABLE_PATH.test(url.pathname)) { event.respondWith(handleImmutableAsset(request)); return; }
  if (url.pathname.startsWith('/brand/') || url.pathname === '/manifest.webmanifest') event.respondWith(handleStatic(request));
});
