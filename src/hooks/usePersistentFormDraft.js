import { useCallback, useEffect, useRef, useState } from 'react';
import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';

const DRAFT_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Persists a serialisable form draft and restores it once for each storage key.
 * Drafts are flushed when the page is hidden, frozen or closed so mobile PWA
 * users do not lose recent typing when the operating system suspends the app.
 */
export function usePersistentFormDraft({
  storageKey,
  value,
  onRestore,
  enabled = true,
  debounceMs = 250,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}) {
  const [readyKey, setReadyKey] = useState(null);
  const valueRef = useRef(value);
  const restoreRef = useRef(onRestore);

  valueRef.current = value;
  restoreRef.current = onRestore;

  useEffect(() => {
    if (!storageKey || readyKey === storageKey) return;

    const stored = readStoredJson('local', storageKey, null);
    const savedAt = Number(stored?.savedAt || 0);
    const valid = stored?.version === DRAFT_VERSION
      && stored?.payload
      && savedAt > 0
      && Date.now() - savedAt <= maxAgeMs;

    if (valid) restoreRef.current?.(stored.payload);
    else if (stored) removeStoredValue('local', storageKey);

    setReadyKey(storageKey);
  }, [maxAgeMs, readyKey, storageKey]);

  const saveNow = useCallback(() => {
    if (!enabled || !storageKey || readyKey !== storageKey) return false;
    return writeStoredJson('local', storageKey, {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      payload: valueRef.current,
    });
  }, [enabled, readyKey, storageKey]);

  const clearDraft = useCallback(() => {
    if (!storageKey) return;
    removeStoredValue('local', storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !storageKey || readyKey !== storageKey) return undefined;
    const timer = window.setTimeout(saveNow, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, readyKey, saveNow, storageKey, value]);

  useEffect(() => {
    if (!enabled || !storageKey || readyKey !== storageKey) return undefined;

    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    const flush = () => saveNow();

    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('freeze', flush);

    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('freeze', flush);
    };
  }, [enabled, readyKey, saveNow, storageKey]);

  return {
    draftReady: Boolean(storageKey && readyKey === storageKey),
    saveNow,
    clearDraft,
  };
}
