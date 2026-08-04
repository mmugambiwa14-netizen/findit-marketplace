import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';

const VIEWER_KEY = 'findit:peek-viewer-key';
const VIEWED_PREFIX = 'findit:peek-viewed:';

function viewerKey() {
  const existing = readStoredString('local', VIEWER_KEY, '');
  if (existing) return existing;
  const created = crypto.randomUUID();
  writeStoredString('local', VIEWER_KEY, created);
  return created;
}

function dailyViewKey(tourId) {
  return `${VIEWED_PREFIX}${tourId}:${new Date().toISOString().slice(0, 10)}`;
}

export function useImmediatePeekView({ tourId, initialCount = 0, enabled = true }) {
  const [count, setCount] = useState(() => Math.max(0, Number(initialCount) || 0));
  const recordingRef = useRef(false);

  useEffect(() => {
    setCount(Math.max(0, Number(initialCount) || 0));
    recordingRef.current = false;
  }, [initialCount, tourId]);

  const recordView = useCallback(async () => {
    if (!enabled || !tourId || recordingRef.current) return;
    const viewedKey = dailyViewKey(tourId);
    if (readStoredString('local', viewedKey, '') === '1') return;

    recordingRef.current = true;
    writeStoredString('local', viewedKey, '1');
    setCount((current) => current + 1);

    try {
      const { data, error } = await supabase.rpc('record_public_tour_view', {
        p_tour_id: tourId,
        p_viewer_key: viewerKey(),
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const authoritativeCount = Number(result?.view_count);
      if (Number.isFinite(authoritativeCount) && authoritativeCount >= 0) {
        setCount(authoritativeCount);
      }
    } catch {
      // Keep playback uninterrupted. Remove the local marker so a later play can retry.
      try { localStorage.removeItem(viewedKey); } catch { /* storage may be unavailable */ }
      setCount((current) => Math.max(0, current - 1));
      recordingRef.current = false;
    }
  }, [enabled, tourId]);

  return { viewCount: count, recordView };
}
