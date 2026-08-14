/**
 * Service worker registration and update lifecycle (PWA §2, §12, §17).
 *
 * Production deliberately keeps updates waiting until the user accepts them,
 * protecting long listing drafts from an application swap mid-edit. Preview
 * deployments are different: their URLs are reused for many builds, so a
 * waiting worker can make a fresh preview appear to run an older shell.
 * Preview origins therefore never retain PeekaListing service-worker state.
 */

const SERVICE_WORKER_URL = '/sw.js';
const OWNED_CACHE_PREFIXES = ['findit-', 'peekalisting-'];

let registration = null;
let refreshing = false;
let activationFallbackTimer = null;
let controllerChangeBound = false;

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

function explicitSharedOriginPreview() {
  return String(viteEnv.VITE_PREVIEW_DEPLOYMENT || '').trim().toLowerCase() === 'true';
}

export function previewDeployment() {
  return explicitSharedOriginPreview()
    || String(viteEnv.VITE_DEPLOY_ENV || '').trim().toLowerCase() === 'preview';
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
  const owned = names.filter((name) => (
    OWNED_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))
  ));
  const results = await Promise.all(owned.map((name) => caches.delete(name)));
  return results.some(Boolean);
}

function registrationBelongsToCurrentPreview(entry) {
  if (!explicitSharedOriginPreview() || typeof window === 'undefined') return true;

  // Shared preview origins can contain unrelated applications. Never unregister
  // a worker outside this deployment's base path.
  const appBase = new URL(String(viteEnv.BASE_URL || '/'), window.location.origin).href;
  return String(entry.scope || '').startsWith(appBase);
}

function reloadWindow() {
  if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
    window.location.reload();
  }
}

function reloadAfterActivation() {
  if (refreshing) return;
  refreshing = true;
  if (activationFallbackTimer !== null) {
    window.clearTimeout(activationFallbackTimer);
    activationFallbackTimer = null;
  }
  reloadWindow();
}

function bindControllerChange() {
  if (controllerChangeBound || !serviceWorkerSupported()) return;
  controllerChangeBound = true;
  navigator.serviceWorker.addEventListener('controllerchange', reloadAfterActivation);
}

async function currentRegistration() {
  if (registration) return registration;
  if (!serviceWorkerSupported()) return null;
  try {
    registration = await navigator.serviceWorker.getRegistration('/');
  } catch {
    registration = null;
  }
  return registration;
}

/**
 * Removes stale preview-only delivery state without touching unrelated caches.
 *
 * @returns {Promise<boolean>} whether a controller, registration, or PeekaListing
 * cache existed and a one-time reload is therefore useful.
 */
export async function resetPreviewServiceWorkerState() {
  if (!previewDeployment() || !serviceWorkerSupported()) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const ownedRegistrations = registrations.filter(registrationBelongsToCurrentPreview);
    const hadController = ownedRegistrations.some((entry) => (
      navigator.serviceWorker.controller
      && navigator.serviceWorker.controller.scriptURL
      && entry.active?.scriptURL === navigator.serviceWorker.controller.scriptURL
    ));
    const unregisterResults = await Promise.all(
      ownedRegistrations.map((entry) => entry.unregister()),
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

  bindControllerChange();

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

  return registration;
}

/** Activates a waiting worker. Called only after the user accepts the prompt. */
export async function applyPendingUpdate() {
  if (refreshing) return;

  const activeRegistration = await currentRegistration();
  let waiting = activeRegistration?.waiting;

  // A fast update can finish between the prompt render and the tap. Re-read
  // the registration before falling back to a normal page reload.
  if (!waiting && activeRegistration) {
    try {
      await activeRegistration.update();
      waiting = activeRegistration.waiting;
    } catch {
      waiting = null;
    }
  }

  if (!waiting) {
    reloadAfterActivation();
    return;
  }

  bindControllerChange();
  try {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    // A worker can disappear while it is being promoted. A normal reload is
    // still useful and keeps the prompt from becoming a dead end.
    reloadAfterActivation();
    return;
  }

  // Safari/iOS and a few embedded browsers have historically missed
  // controllerchange after skipWaiting(). Keep the normal event-driven path,
  // but guarantee that the user's tap still produces a reload.
  activationFallbackTimer = window.setTimeout(() => {
    activationFallbackTimer = null;
    reloadAfterActivation();
  }, 5000);
}

/**
 * Asks the browser to re-check for a new worker. Browsers do this on
 * navigation anyway; this covers long-lived sessions in an installed app that
 * may not navigate for days.
 */
export async function checkForUpdate() {
  if (previewDeployment()) return false;
  const activeRegistration = await currentRegistration();
  if (!activeRegistration) return false;
  try {
    await activeRegistration.update();
    return Boolean(activeRegistration.waiting);
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
    controllerChangeBound = false;
    refreshing = false;
    if (activationFallbackTimer !== null) {
      window.clearTimeout(activationFallbackTimer);
      activationFallbackTimer = null;
    }
  } catch {
    /* best effort -- nothing here should surface to the user */
  }
}
