import { useCallback, useEffect, useState } from 'react';

/**
 * Connectivity awareness (PWA §11).
 *
 * `navigator.onLine` reports only whether a network interface exists. A captive
 * portal, an expired hotspot session or a dead uplink all still report `true`,
 * which is precisely the situation this marketplace's users hit on unstable
 * mobile networks. So `online` here means "the browser thinks there is a
 * network", and `reachable` means "a real request to our own origin succeeded".
 * The UI should trust `reachable`.
 *
 * `navigator.connection` is Chromium-only. Every field derived from it degrades
 * to a safe default elsewhere rather than pretending to know.
 */

const PROBE_URL = '/manifest.webmanifest';
const SLOW_TYPES = new Set(['slow-2g', '2g']);

function readConnection() {
  const connection = typeof navigator !== 'undefined'
    ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
    : null;

  if (!connection) {
    return { effectiveType: null, saveData: false, slow: false, metered: false };
  }

  return {
    effectiveType: connection.effectiveType ?? null,
    // The user has explicitly asked for reduced data use. Honour it: skip
    // prefetching, avoid autoplay, prefer smaller images.
    saveData: Boolean(connection.saveData),
    slow: SLOW_TYPES.has(connection.effectiveType),
    // Cellular is treated as potentially expensive. `type` is not universally
    // populated, so absence means "assume not metered" rather than guessing.
    metered: connection.type === 'cellular' || Boolean(connection.saveData),
  };
}

async function probeReachable(signal) {
  try {
    const response = await fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store', signal });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @returns {{
 *   online: boolean, reachable: boolean, wasOffline: boolean,
 *   effectiveType: string|null, saveData: boolean, slow: boolean, metered: boolean,
 *   recheck: () => Promise<boolean>
 * }}
 */
export function useConnectivity() {
  const [online, setOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  );
  const [reachable, setReachable] = useState(true);
  // Lets the UI say "back online" rather than silently resuming, which reads as
  // a glitch to someone who watched the app fail a moment ago.
  const [wasOffline, setWasOffline] = useState(false);
  const [connection, setConnection] = useState(readConnection);

  const recheck = useCallback(async () => {
    const ok = await probeReachable();
    setReachable((previous) => {
      if (!previous && ok) setWasOffline(true);
      return ok;
    });
    return ok;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const settle = (ok) => {
      if (cancelled) return;
      setReachable((previous) => {
        if (!previous && ok) setWasOffline(true);
        return ok;
      });
    };

    const handleOnline = () => {
      setOnline(true);
      probeReachable(controller.signal).then(settle);
    };
    const handleOffline = () => {
      setOnline(false);
      settle(false);
    };
    const handleConnectionChange = () => setConnection(readConnection());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const raw = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    raw?.addEventListener?.('change', handleConnectionChange);

    // Confirm on return to the tab: a phone that slept through a network change
    // fires no event, so the first thing a returning user sees would otherwise
    // be stale.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        probeReachable(controller.signal).then(settle);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (navigator.onLine === false) settle(false);

    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      raw?.removeEventListener?.('change', handleConnectionChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Clear the "was offline" flag once the UI has had a beat to show it.
  useEffect(() => {
    if (!wasOffline) return undefined;
    const timer = window.setTimeout(() => setWasOffline(false), 4000);
    return () => window.clearTimeout(timer);
  }, [wasOffline]);

  return { online, reachable, wasOffline, recheck, ...connection };
}
