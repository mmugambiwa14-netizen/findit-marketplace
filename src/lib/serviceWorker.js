/**
 * Service worker registration and update lifecycle (PWA §2, §12, §17).
 *
 * Two deliberate choices shape this module.
 *
 * 1. The worker never activates itself. `public/sw.js` omits `skipWaiting()`,
 *    so a new build waits until the page explicitly allows it. A marketplace
 *    where sellers fill in long listing forms cannot afford a worker swapping
 *    the app out mid-draft -- §17 asks for updates that avoid data loss, and
 *    the only way to guarantee that is to let the user choose the moment.
 *
 * 2. Registration is deferred until after load and gated on secure context.
 *    Service workers require HTTPS (localhost excepted), and registering during
 *    startup competes with the first paint for bandwidth on exactly the slow
 *    connections this is meant to help.
 */

const SERVICE_WORKER_URL = '/sw.js';

let registration = null;
let refreshing = false;

export function serviceWorkerSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof window !== 'undefined'
    // A worker on an insecure origin is impossible; attempting it throws.
    && (window.isSecureContext || window.location.hostname === 'localhost');
}

/**
 * Registers the worker and reports when an update is waiting.
 *
 * @param {{ onUpdateReady?: () => void, onReady?: () => void }} handlers
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker({ onUpdateReady, onReady } = {}) {
  if (!serviceWorkerSupported()) return null;

  try {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
  } catch {
    // A failed registration must never break the application. The app works
    // exactly as before without a worker; it simply loses offline support.
    return null;
  }

  // A worker already waiting means the user loaded the page with an update
  // pending from a previous visit.
  if (registration.waiting && navigator.serviceWorker.controller) {
    onUpdateReady?.();
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state !== 'installed') return;
      if (navigator.serviceWorker.controller) {
        // An existing controller means this is an update, not a first install.
        onUpdateReady?.();
      } else {
        onReady?.();
      }
    });
  });

  // One reload, and only after the new worker takes control. Without the guard
  // a fast double activation can loop the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  return registration;
}

/** Activates a waiting worker. Called only after the user accepts the prompt. */
export function applyPendingUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Asks the browser to re-check for a new worker. Browsers do this on
 * navigation anyway; this covers long-lived sessions in an installed app that
 * may not navigate for days.
 */
export async function checkForUpdate() {
  if (!registration) return false;
  try {
    await registration.update();
    return Boolean(registration.waiting);
  } catch {
    return false;
  }
}

/** The running worker's build fingerprint, for support and diagnostics. */
export async function getActiveVersion() {
  if (!navigator.serviceWorker?.controller) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(event.data?.version ?? null);
    };
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

/**
 * Removes the worker and every cache it owns.
 *
 * Two uses: recovering from a corrupted cache (§16), and sign-out. Even though
 * the worker never caches user data, clearing on sign-out means a shared device
 * cannot serve the previous account's shell state.
 */
export async function unregisterServiceWorker() {
  if (!serviceWorkerSupported()) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((entry) => entry.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('findit-')).map((name) => caches.delete(name)),
      );
    }
  } catch {
    /* best effort -- nothing here should surface to the user */
  }
}
