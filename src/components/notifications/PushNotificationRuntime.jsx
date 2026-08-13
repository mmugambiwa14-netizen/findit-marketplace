import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getNotificationPreferences } from '@/repositories/notificationPreferencesRepository';
import { normalizePushPayload } from '@/services/pushContracts';
import { playNotificationTone } from '@/services/notificationTone';
import { syncWebPushSubscription, syncWebPushSubscriptionData } from '@/services/webPushService';

export default function PushNotificationRuntime() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const seenIds = useRef(new Set());
  const preferencesKey = ['notification-preferences', user?.id ?? null];
  const preferencesQuery = useQuery({
    queryKey: preferencesKey,
    queryFn: getNotificationPreferences,
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    seenIds.current.clear();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    const handleMessage = (event) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        const sync = message.subscription
          ? syncWebPushSubscriptionData(message.subscription)
          : getCurrentSubscriptionAndSync();
        void sync.catch(() => {});
        return;
      }

      if (message.type !== 'PUSH_NOTIFICATION') return;
      let payload;
      try {
        payload = normalizePushPayload(message.payload);
      } catch {
        return;
      }
      if (payload.alertId) {
        if (seenIds.current.has(payload.alertId)) return;
        seenIds.current.add(payload.alertId);
        if (seenIds.current.size > 100) seenIds.current.delete(seenIds.current.values().next().value);
      }

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['peek-request-activity'] });
      queryClient.invalidateQueries({ queryKey: ['seller-peek-request-queue'] });

      const isCurrentChat = payload.type === 'message_received'
        && /^\/chats\/[0-9a-f-]+$/i.test(location.pathname)
        && payload.url === location.pathname;
      if (!isCurrentChat) {
        toast(payload.title, {
          description: payload.body,
          action: {
            label: 'Open',
            onClick: () => navigate(payload.url),
          },
        });
      }
      if (!isCurrentChat && preferencesQuery.data?.inAppSoundEnabled !== false) {
        void playNotificationTone({ enabled: true });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [location.pathname, navigate, preferencesQuery.data?.inAppSoundEnabled, queryClient, user?.id]);

  return null;
}

async function getCurrentSubscriptionAndSync() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await syncWebPushSubscription(subscription);
}
