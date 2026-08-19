import { useEffect, useState } from 'react';
import { BellRing, Loader2, Smartphone, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  disableWebPush,
  enableWebPush,
  getCurrentPushSubscription,
  getWebPushPreferences,
  updateWebPushPreferences,
  webPushSupport,
} from '@/services/webPushService';
import {
  notificationSoundEnabled,
  primeNotificationSound,
  setNotificationSoundEnabled,
} from '@/services/notificationSoundService';

const DEFAULT_PREFS = {
  messages: true,
  peekActivity: true,
  listingActivity: true,
  businessActivity: true,
  moderation: true,
};

const CATEGORIES = [
  ['messages', 'Messages', 'New chat messages'],
  ['peekActivity', 'Peek activity', 'Peek requests, answers and processing updates'],
  ['listingActivity', 'Listing activity', 'Listing approvals, status and saved-listing changes'],
  ['businessActivity', 'Business activity', 'Business applications, categories and managed listings'],
  ['moderation', 'Reports and moderation', 'Resolved reports and moderation outcomes'],
];

export default function PushNotificationSettings() {
  const [state, setState] = useState(() => ({ ...webPushSupport(), subscribed: false }));
  const [soundEnabled, setSoundEnabled] = useState(notificationSoundEnabled);
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);
  const [initializing, setInitializing] = useState(true);
  const [working, setWorking] = useState(false);
  const [savingPreference, setSavingPreference] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getCurrentPushSubscription(), getWebPushPreferences()]).then(([subscriptionResult, preferenceResult]) => {
      if (!active) return;
      const subscription = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value : null;
      setState({ ...webPushSupport(), subscribed: Boolean(subscription) });
      if (preferenceResult.status === 'fulfilled') setPreferences(preferenceResult.value);
    }).finally(() => {
      if (active) setInitializing(false);
    });
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    setWorking(true);
    try {
      if (state.subscribed) {
        await disableWebPush();
        setState({ ...webPushSupport(), subscribed: false });
        toast.success('Push notifications disabled on this device');
      } else {
        await enableWebPush();
        setState({ ...webPushSupport(), subscribed: true, permission: 'granted' });
        toast.success('Push notifications enabled on this device');
      }
    } catch (error) {
      toast.error(error.message || 'Could not update push notifications');
      setState({ ...webPushSupport(), subscribed: Boolean(await getCurrentPushSubscription().catch(() => null)) });
    } finally {
      setWorking(false);
    }
  };

  const toggleSound = async (enabled) => {
    setNotificationSoundEnabled(enabled);
    setSoundEnabled(enabled);
    if (enabled) await primeNotificationSound();
  };

  const togglePreference = async (key, enabled) => {
    const previous = preferences;
    const next = { ...preferences, [key]: enabled };
    setPreferences(next);
    setSavingPreference(key);
    try {
      setPreferences(await updateWebPushPreferences(next));
    } catch (error) {
      setPreferences(previous);
      toast.error(error.message || 'Could not update notification preferences');
    } finally {
      setSavingPreference(null);
    }
  };

  if (initializing) return <ListRowsSkeleton rows={2} showThumbnail={false} label="Checking push notification status" />;

  if (!state.supported) {
    return <p className="text-sm text-muted-foreground">This browser does not support Web Push notifications.</p>;
  }

  const iosNeedsInstall = /iphone|ipad|ipod/i.test(navigator.userAgent) && !state.standalone;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="locked-icon-tile h-10 w-10 shrink-0"><Smartphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Notifications outside PeekaListing</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Receive important message, Peek, listing, business and account alerts when the installed app is backgrounded or closed.
          </p>
        </div>
      </div>

      {iosNeedsInstall && <div className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5">On iPhone or iPad, first add PeekaListing to your Home Screen, then reopen the installed app and enable notifications here.</div>}
      {!state.configured && <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">Push delivery is not configured for this deployment yet. In-app notifications continue to work.</div>}
      {state.permission === 'denied' && <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs leading-5">Notifications are blocked in your device settings. Allow notifications for PeekaListing there, then return to this page.</div>}

      <Button type="button" variant={state.subscribed ? 'outline' : 'default'} className="rounded-xl" disabled={working || !state.configured || iosNeedsInstall || state.permission === 'denied'} onClick={toggle}>
        {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
        {state.subscribed ? 'Disable on this device' : 'Enable push notifications'}
      </Button>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <div><p className="text-sm font-medium">Push categories</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Choose which marketplace activity can appear as push notifications. Essential account and security updates remain enabled.</p></div>
        {CATEGORIES.map(([key, label, description]) => (
          <fieldset
            key={key}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-border/70 pt-2 first:border-0 first:pt-0"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('[role="switch"]')) return;
              if (savingPreference === null) void togglePreference(key, !preferences[key]);
            }}
          >
            <legend className="sr-only">{label} push notifications</legend>
            <span><span className="block text-sm">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
            <Switch checked={preferences[key]} disabled={savingPreference !== null} onCheckedChange={(enabled) => togglePreference(key, enabled)} aria-label={`${label} push notifications`} />
          </fieldset>
        ))}
      </div>

      <fieldset
        className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card px-3 py-3"
        onClick={(event) => {
          if (!(event.target instanceof Element && event.target.closest('[role="switch"]'))) void toggleSound(!soundEnabled);
        }}
      >
        <legend className="sr-only">In-app notification sound</legend>
        <div className="flex min-w-0 items-start gap-3"><Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">In-app notification sound</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Play the PeekaListing tone while the app is open. Background notification sound is controlled by your device.</p></div></div>
        <Switch checked={soundEnabled} onCheckedChange={toggleSound} aria-label="In-app notification sound" />
      </fieldset>
    </div>
  );
}
