/* FindIt Web Push handlers. Loaded by the stamped service worker. */

function safePushPayload(event) {
  try {
    return event.data?.json() || {};
  } catch {
    return { title: 'FindIt', body: event.data?.text() || 'You have a new update.' };
  }
}

self.addEventListener('push', (event) => {
  const payload = safePushPayload(event);
  const title = String(payload.title || 'FindIt');
  const options = {
    body: String(payload.body || payload.message || 'You have a new update.'),
    icon: payload.icon || '/brand/findit-icon-192.png',
    badge: payload.badge || '/brand/findit-icon-192.png',
    tag: payload.tag || payload.alertId || undefined,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || payload.link || '/notifications',
      alertId: payload.alertId || null,
      type: payload.type || 'account',
    },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    if (Number.isFinite(payload.badgeCount) && self.registration.setAppBadge) {
      await self.registration.setAppBadge(Math.max(0, Number(payload.badgeCount)));
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});
