/* PeekaListing Web Push handlers. Loaded by the stamped service worker. */

const STAGING_HOST_PREFIXES = ['peekalisting-stagi', 'findit-marketplace-stagi'];
const DEFAULT_PATH = '/notifications';
const DEFAULT_ICON = '/brand/peekalisting-icon-192.png';
const DEFAULT_BADGE = '/brand/peekalisting-icon-64.png';
const UUID_PART = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const SAFE_PATH = new RegExp(
  `^(?:/(?:notifications|my-listings|profile|settings|chats|saved|post|peek-requests)|/peek-requests\\?request=${UUID_PART}|/(?:chats|messages)/${UUID_PART}|/(?:property|car|machinery|service)/${UUID_PART}(?:\\?responsePeek=${UUID_PART})?(?:#peek-threads)?)$`,
  'i',
);

function isStagingOrigin() {
  return STAGING_HOST_PREFIXES.some((prefix) => self.location.hostname.startsWith(prefix));
}

function boundedText(value, fallback, maximum) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, maximum);
}

function safeNotificationPath(value) {
  if (typeof value !== 'string') return DEFAULT_PATH;
  const candidate = value.trim();
  if (!candidate || candidate.startsWith('//') || !candidate.startsWith('/')) return DEFAULT_PATH;
  try {
    const parsed = new URL(candidate, self.location.origin);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      parsed.origin !== self.location.origin
      || parsed.username
      || parsed.password
      || !SAFE_PATH.test(path)
    ) return DEFAULT_PATH;
    return path;
  } catch {
    return DEFAULT_PATH;
  }
}

function safeAssetPath(value, fallback) {
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = new URL(value.trim(), self.location.origin);
    if (parsed.origin !== self.location.origin || parsed.username || parsed.password) return fallback;
    const path = `${parsed.pathname}${parsed.search}`;
    return path.startsWith('/brand/') ? path : fallback;
  } catch {
    return fallback;
  }
}

function safePushPayload(event) {
  let raw = {};
  try {
    raw = event.data?.json() || {};
  } catch {
    try {
      raw = { body: event.data?.text() || 'You have a new update.' };
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};

  const alertId = typeof raw.alertId === 'string' ? raw.alertId.trim().slice(0, 80) : null;
  const type = boundedText(raw.type, 'account', 80);
  return {
    title: boundedText(raw.title, 'PeekaListing', 80),
    body: type === 'message_received'
      ? 'You have a new message in PeekaListing.'
      : boundedText(raw.body || raw.message, 'You have a new PeekaListing update.', 180),
    icon: safeAssetPath(raw.icon, DEFAULT_ICON),
    badge: safeAssetPath(raw.badge, DEFAULT_BADGE),
    tag: boundedText(raw.tag, alertId || 'peekalisting', 120),
    renotify: Boolean(raw.renotify),
    requireInteraction: Boolean(raw.requireInteraction),
    badgeCount: Number.isFinite(Number(raw.badgeCount)) ? Math.max(0, Math.trunc(Number(raw.badgeCount))) : null,
    data: {
      url: safeNotificationPath(raw.url || raw.link),
      alertId,
      type,
    },
  };
}

async function visibleWindowClient() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin && client.visibilityState === 'visible';
    } catch {
      return false;
    }
  }) || null;
}

self.addEventListener('install', (event) => {
  if (!isStagingOrigin()) return;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('push', (event) => {
  const payload = safePushPayload(event);
  event.waitUntil((async () => {
    const foreground = await visibleWindowClient();
    if (foreground) {
      foreground.postMessage({ type: 'PUSH_NOTIFICATION', payload });
      return;
    }

    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: payload.renotify,
      requireInteraction: payload.requireInteraction,
      data: payload.data,
    });
    if (payload.badgeCount !== null && typeof self.registration.setAppBadge === 'function') {
      await self.registration.setAppBadge(payload.badgeCount).catch(() => {});
    }
  })().catch(() => {
    // A malformed payload or a platform-specific notification failure must not
    // terminate the worker or break future pushes.
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safeNotificationPath(event.notification.data?.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });
    if (existing) {
      await existing.focus();
      if (typeof existing.navigate === 'function') await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })().catch(() => {}));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const subscription = event.newSubscription;
    const json = subscription?.toJSON?.() || null;
    const message = {
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      subscription: json && {
        endpoint: json.endpoint || null,
        keys: json.keys || null,
      },
    };
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage(message));
  })().catch(() => {}));
});
