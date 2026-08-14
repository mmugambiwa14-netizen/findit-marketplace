import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectivity } from '@/hooks/useConnectivity';
import {
  applyPendingUpdate,
  checkForUpdate,
  previewDeployment,
  registerServiceWorker,
  resetPreviewServiceWorkerState,
  serviceWorkerSupported,
} from '@/lib/serviceWorker';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';

/**
 * PWA runtime state: connectivity, update availability, and install eligibility
 * (PWA §6, §11, §17).
 *
 * Everything here degrades to inert. On a browser without service workers, or
 * with registration blocked, the context still renders its children and the
 * application behaves exactly as it did before -- no offline support, no
 * prompts, no errors.
 */

const PwaContext = createContext(null);

const INSTALL_DISMISSED_KEY = '__findit_install_dismissed_at';
const PREVIEW_RESET_KEY = '__findit_preview_service_worker_reset';
const INSTALL_DISMISS_DAYS = 30;
const UPDATE_POLL_MS = 30 * 60 * 1000;

function installRecentlyDismissed() {
  const stored = Number(readStoredString('local', INSTALL_DISMISSED_KEY) || 0);
  if (!Number.isFinite(stored) || stored <= 0) return false;
  return Date.now() - stored < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/** True when the app is already running as an installed PWA. */
function runningStandalone() {
  if (typeof window === 'undefined') return false;
  // `navigator.standalone` is Safari-only and absent from the DOM lib, but it
  // is the sole way to detect an installed PWA on iOS -- display-mode media
  // queries do not report standalone there.
  const nav = /** @type {Navigator & { standalone?: boolean }} */ (window.navigator);
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.matchMedia?.('(display-mode: minimal-ui)')?.matches
    || nav.standalone === true,
  );
}

export function PwaProvider({ children }) {
  const connectivity = useConnectivity();
  const [updateReady, setUpdateReady] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [standalone, setStandalone] = useState(runningStandalone);
  const [installEvent, setInstallEvent] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(installRecentlyDismissed);
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current || !serviceWorkerSupported()) return undefined;
    registered.current = true;

    if (previewDeployment()) {
      // Branch aliases are reused across deployments. Remove an older worker
      // and its FindIt-owned shell caches, then reload once so the current
      // deployment takes control immediately rather than after another visit.
      resetPreviewServiceWorkerState().then((changed) => {
        if (!changed || readStoredString('session', PREVIEW_RESET_KEY) === '1') return;
        writeStoredString('session', PREVIEW_RESET_KEY, '1');
        window.location.reload();
      });
      return undefined;
    }

    // Registering after load keeps the worker's own fetch off the critical path
    // on exactly the slow connections offline support is meant to help.
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      registerServiceWorker({
        onUpdateReady: () => { if (!cancelled) setUpdateReady(true); },
      });
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  }, []);

  // An installed app can go days without a navigation, which is how browsers
  // normally notice a new worker. Poll gently to cover that in production only.
  useEffect(() => {
    if (!serviceWorkerSupported() || previewDeployment()) return undefined;
    const timer = window.setInterval(() => {
      checkForUpdate().then((waiting) => { if (waiting) setUpdateReady(true); });
    }, UPDATE_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      // Chromium fires this when the app is installable. Holding the event lets
      // the prompt appear at a moment the user chose rather than on page load.
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const media = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayChange = (event) => setStandalone(event.matches);
    media?.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      media?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return 'unavailable';
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'dismissed') {
      writeStoredString('local', INSTALL_DISMISSED_KEY, String(Date.now()));
      setInstallDismissed(true);
    }
    return outcome;
  }, [installEvent]);

  const dismissInstall = useCallback(() => {
    writeStoredString('local', INSTALL_DISMISSED_KEY, String(Date.now()));
    setInstallDismissed(true);
  }, []);

  const applyUpdate = useCallback(async () => {
    if (applyingUpdate) return;
    setApplyingUpdate(true);
    // Do not leave an obsolete banner over the new shell while activation is
    // finishing. If activation fails, the catch path restores it.
    setUpdateReady(false);
    try {
      await applyPendingUpdate();
    } catch (error) {
      setApplyingUpdate(false);
      setUpdateReady(true);
      throw error;
    }
  }, [applyingUpdate]);

  const refreshApp = useCallback(async () => {
    // A manual refresh should also activate a version the browser has downloaded
    // but not yet promoted. When there is no waiting worker, use a normal reload.
    if (serviceWorkerSupported() && !previewDeployment()) {
      const waiting = await checkForUpdate();
      if (waiting) {
        await applyUpdate();
        return;
      }
    }
    window.location.reload();
  }, [applyUpdate]);

  const value = useMemo(() => ({
    ...connectivity,
    updateReady,
    applyUpdate,
    refreshApp,
    standalone,
    // Never offered when already installed, when the browser has not said the
    // app is installable, or within the dismissal window. §6: no spamming.
    canInstall: Boolean(installEvent) && !standalone && !installDismissed,
    promptInstall,
    dismissInstall,
  }), [connectivity, updateReady, applyUpdate, refreshApp, standalone, installEvent, installDismissed,
    promptInstall, dismissInstall]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

/**
 * Safe to call outside the provider: returns inert defaults rather than
 * throwing, so a component using it cannot break a tree that has no provider.
 */
export function usePwa() {
  return useContext(PwaContext) ?? {
    online: true,
    reachable: true,
    wasOffline: false,
    slow: false,
    saveData: false,
    metered: false,
    effectiveType: null,
    recheck: async () => true,
    updateReady: false,
    applyUpdate: () => {},
    refreshApp: () => window.location.reload(),
    standalone: false,
    canInstall: false,
    promptInstall: async () => 'unavailable',
    dismissInstall: () => {},
  };
}
