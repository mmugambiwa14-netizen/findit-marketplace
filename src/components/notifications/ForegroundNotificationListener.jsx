import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { playNotificationSound, primeNotificationSound } from '@/services/notificationSoundService';

const MAX_SEEN = 200;

function safeInternalPath(value) {
  const path = typeof value === 'string' ? value.trim() : '';
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://') ? path : '/notifications';
}

function updateAppBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  if (count > 0) navigator.setAppBadge(count).catch(() => {});
  else navigator.clearAppBadge?.().catch(() => {});
}

function openInternalPath(path) {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  window.location.assign(`${base}${path}` || '/');
}

export default function ForegroundNotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const seenRef = useRef(new Set());

  useEffect(() => {
    const prime = () => primeNotificationSound();
    window.addEventListener('pointerdown', prime, { once: true, passive: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_alerts',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const item = payload.new || {};
        if (!item.event_type) return;
        const id = String(item.id || '');
        if (!id || seenRef.current.has(id)) return;
        seenRef.current.add(id);
        if (seenRef.current.size > MAX_SEEN) {
          const first = seenRef.current.values().next().value;
          seenRef.current.delete(first);
        }

        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        const unreadKey = ['notifications', 'unread-count', user.id];
        const unread = Number(queryClient.getQueryData(unreadKey)) || 0;
        queryClient.setQueryData(unreadKey, unread + 1);
        updateAppBadge(unread + 1);

        const link = safeInternalPath(item.link);
        const currentlyViewingTarget = window.location.pathname.endsWith(link);
        if (document.visibilityState === 'visible') {
          if (!currentlyViewingTarget) {
            toast(item.title || 'PeekaListing update', {
              description: item.message || 'You have a new notification.',
              action: { label: 'Open', onClick: () => openInternalPath(link) },
            });
          }
          playNotificationSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) updateAppBadge(0);
  }, [user?.id]);

  return null;
}
