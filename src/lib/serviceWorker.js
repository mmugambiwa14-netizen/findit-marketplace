/**
 * Service worker registration and update lifecycle (PWA §2, §12, §17).
 *
 * Production deliberately keeps updates waiting until the user accepts them,
 * protecting long listing drafts from an application swap mid-edit. Vercel
 * preview deployments are different: their branch aliases are reused for many
 * builds, so a waiting worker can make a fresh preview appear to run an older
 * shell. Preview origins therefore never retain FindIt service-worker state.
 */

const SERVICE_WORKER_URL = '/sw.js';
const FINDIT_CACHE_PREFIX = 'findit-';

let registration = null;
let refreshing = false;

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

export function previewDeployment() {
  return String(viteEnv.VITE_VERCEL_ENV || '').trim() === 'preview'
    || String(viteEnv.VITE_VERCEL_TARGET_ENV || '').trim() === 'preview';
}

export function serviceWorkerSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof window !== 'undefined'
    // A worker on an insecure origin is impossible; attempting it throws.
    && (window.isSecureContext || window.location.hostname === 'localhost');
}

async function deleteFindItCaches() {
  if (typeof caches === 'undefined') return false;
  const names = await caches.keys();
  const owned = names.filter((name) => name.startsWith(FINDIT_CACHE_PREFIX));
  const results = await Promise.all(owned.map((name) => caches.delete(name)));
  return results.some(Boolean);
}

/**
 * Removes stale preview-only delivery state without touching unrelated caches.
 *
 * @returns {Promise<boolean>} whether a controller, registration, or FindIt
 * cache existed and a one-time reload is therefore useful.
 */
export async function resetPreviewServiceWorkerState() {
  if (!previewDeployment() || !serviceWorkerSupported()) return false;

  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations();
    const unregisterResults = await Promise.all(
      registrations.map((entry) => entry.unregister()),
    );
    const deletedCache = await deleteFindItCaches();
    registration = null;
    return hadController || unregisterResults.some(Boolean) || deletedCache;
  } catch {
    // Preview recovery is best effort and must never prevent the application
    // from rendering.
    return false;
  }
}

/**
 * Registers the worker and reports when an update is waiting.
 *
 * @param {{ onUpdateReady?: () => void, onReady?: () => void }} handlers
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker({ onUpdateReady, onReady } = {}) {
  if (!serviceWorkerSupported() || previewDeployment()) return null;

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
  if (!registration || previewDeployment()) return false;
  try {
    await registration.update();
    return Boolean(registration.waiting);
  } catch {
    return false;
  }
}

/** The running worker's build fingerprint, for support and diagnostics. */
export async function getActiveVersion() {
  if (!navigator.serviceWorker?.controller || previewDeployment()) return null;
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
    await deleteFindItCaches();
    registration = null;
  } catch {
    /* best effort -- nothing here should surface to the user */
  }
}
