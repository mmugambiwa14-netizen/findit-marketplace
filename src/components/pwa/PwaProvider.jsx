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
import ForegroundNotificationListener from '@/components/notifications/ForegroundNotificationListener';

/**
 * PWA runtime state: connectivity, update availability, install eligibility,
 * and the foreground half of the canonical notification experience.
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

function runningStandalone() {
  if (typeof window === 'undefined') return false;
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
      resetPreviewServiceWorkerState().then((changed) => {
        if (!changed || readStoredString('session', PREVIEW_RESET_KEY) === '1') return;
        writeStoredString('session', PREVIEW_RESET_KEY, '1');
        window.location.reload();
      });
      return undefined;
    }

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      registerServiceWorker({ onUpdateReady: () => { if (!cancelled) setUpdateReady(true); } });
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  }, []);

  useEffect(() => {
    if (!serviceWorkerSupported() || previewDeployment()) return undefined;
    const timer = window.setInterval(() => {
      checkForUpdate().then((waiting) => { if (waiting) setUpdateReady(true); });
    }, UPDATE_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
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
    canInstall: Boolean(installEvent) && !standalone && !installDismissed,
    promptInstall,
    dismissInstall,
  }), [connectivity, updateReady, applyUpdate, refreshApp, standalone, installEvent, installDismissed,
    promptInstall, dismissInstall]);

  return (
    <PwaContext.Provider value={value}>
      {children}
      <ForegroundNotificationListener />
    </PwaContext.Provider>
  );
}

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
