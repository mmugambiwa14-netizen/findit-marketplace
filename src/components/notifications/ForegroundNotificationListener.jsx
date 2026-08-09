import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
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

export default function ForegroundNotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
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
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const item = payload.new || {};
        const id = String(item.id || '');
        if (!id || seenRef.current.has(id)) return;
        seenRef.current.add(id);
        if (seenRef.current.size > MAX_SEEN) {
          const first = seenRef.current.values().next().value;
          seenRef.current.delete(first);
        }

        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        const unread = Number(queryClient.getQueryData(['notifications', 'unread-count', user.id])) || 0;
        queryClient.setQueryData(['notifications', 'unread-count', user.id], unread + 1);
        updateAppBadge(unread + 1);

        const link = safeInternalPath(item.link);
        const currentlyViewingTarget = location.pathname === link;
        if (document.visibilityState === 'visible') {
          if (!currentlyViewingTarget) {
            toast(item.title || 'PeekaListing update', {
              description: item.message || 'You have a new notification.',
              action: { label: 'Open', onClick: () => navigate(link) },
            });
          }
          playNotificationSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [location.pathname, navigate, queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) updateAppBadge(0);
  }, [user?.id]);

  return null;
}
