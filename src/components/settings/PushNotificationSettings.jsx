import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  disableWebPush,
  enableWebPush,
  getCurrentPushSubscription,
  webPushSupport,
} from '@/services/webPushService';
import { getNotificationPreferences, updateNotificationPreferences } from '@/repositories/notificationPreferencesRepository';
import { classifyPushPermission } from '@/services/pushContracts';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const PREFERENCES_KEY = ['notification-preferences'];

export default function PushNotificationSettings() {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => ({ ...webPushSupport(), subscribed: false }));
  const [initializing, setInitializing] = useState(true);
  const [working, setWorking] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const preferencesQuery = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: getNotificationPreferences,
    staleTime: 5 * 60_000,
  });
  const preferenceMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(PREFERENCES_KEY, data),
    onError: (error) => toast.error(error.message || 'Could not update notification preferences'),
  });

  useEffect(() => {
    let active = true;
    getCurrentPushSubscription()
      .then((subscription) => {
        if (active) setState({ ...webPushSupport(), subscribed: Boolean(subscription) });
      })
      .catch(() => {})
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, []);

  const iosNeedsInstall = state.ios && !state.standalone;
  const active = state.subscribed && preferencesQuery.data?.pushEnabled !== false;
  const status = useMemo(() => classifyPushPermission({
    ...state,
    subscribed: active,
  }), [state, active]);

  const refreshState = async () => {
    const subscription = await getCurrentPushSubscription().catch(() => null);
    setState({ ...webPushSupport(), subscribed: Boolean(subscription) });
  };

  const enable = async () => {
    setWorking(true);
    try {
      await enableWebPush();
      await preferenceMutation.mutateAsync({ pushEnabled: true });
      setExplanationOpen(false);
      await refreshState();
      toast.success('Push notifications enabled on this device');
    } catch (error) {
      toast.error(error.message || 'Could not enable push notifications');
      await refreshState();
    } finally {
      setWorking(false);
    }
  };

  const disable = async () => {
    setWorking(true);
    try {
      await disableWebPush();
      await preferenceMutation.mutateAsync({ pushEnabled: false });
      await refreshState();
      toast.success('Push notifications disabled');
    } catch (error) {
      toast.error(error.message || 'Could not disable push notifications');
      await refreshState();
    } finally {
      setWorking(false);
    }
  };

  if (initializing || preferencesQuery.isLoading) {
    return <ListRowsSkeleton rows={2} showThumbnail={false} label="Checking notification status" />;
  }

  if (preferencesQuery.error) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm text-destructive">Notification preferences are temporarily unavailable.</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => void preferencesQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!state.supported) {
    return <p className="text-sm text-muted-foreground">This browser or device does not support Web Push notifications.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-10 w-10 shrink-0"><Smartphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Notifications outside PeekaListing</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Receive important messages, Peek updates, listing decisions and account alerts when the app is backgrounded or closed.
          </p>
        </div>
      </div>

      {status === 'not-configured' && (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5" role="status">
          Push notifications are not configured for this deployment yet. The rest of PeekaListing remains available.
        </div>
      )}

      {iosNeedsInstall && (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5">
          On iPhone or iPad, first add PeekaListing to your Home Screen, then reopen the installed app and enable notifications here.
        </div>
      )}

      {state.permission === 'denied' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs leading-5" role="alert">
          Notifications are blocked in your device settings. Allow notifications for PeekaListing there, then return to this page.
        </div>
      )}

      {active && (
        <p className="flex items-center gap-2 text-xs text-success" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Push is enabled on this device.
        </p>
      )}

      {!active && !explanationOpen && (
        <Button
          type="button"
          className="rounded-xl"
          disabled={working || iosNeedsInstall || state.permission === 'denied' || status === 'not-configured'}
          onClick={() => setExplanationOpen(true)}
        >
          <BellRing className="mr-2 h-4 w-4" /> Enable push notifications
        </Button>
      )}

      {active && (
        <Button type="button" variant="outline" className="rounded-xl" disabled={working} onClick={() => void disable()}>
          {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
          Disable push notifications
        </Button>
      )}

      {explanationOpen && !active && (
        <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4" role="dialog" aria-labelledby="push-permission-title">
          <div>
            <h3 id="push-permission-title" className="text-sm font-semibold">Allow useful PeekaListing alerts?</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              We will use your browser permission to alert you about important messages, Peek activity and listing decisions. You can turn this off here or in device settings at any time.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="rounded-xl" disabled={working} onClick={() => void enable()}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
              Continue and allow notifications
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" disabled={working} onClick={() => setExplanationOpen(false)}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
