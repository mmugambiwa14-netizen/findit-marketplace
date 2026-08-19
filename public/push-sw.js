/* PeekaListing push subscription lifecycle. Loaded by the stamped service worker.
 *
 * Push rendering and notification click routing live in public/sw.js and must
 * NOT be duplicated here. Both files execute in the same worker scope, so a
 * second 'push' or 'notificationclick' listener registered here would show a
 * competing notification and race the click routing to the wrong destination.
 */

const STAGING_HOST_PREFIXES = ['peekalisting-stagi', 'findit-marketplace-stagi'];
const CANONICAL_STAGING_HOST = 'staging.peekalisting.com';

function isStagingOrigin() {
  const hostname = String(self.location.hostname || '').toLowerCase();
  return hostname === CANONICAL_STAGING_HOST
    || STAGING_HOST_PREFIXES.some((prefix) => hostname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  if (!isStagingOrigin()) return;
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});
