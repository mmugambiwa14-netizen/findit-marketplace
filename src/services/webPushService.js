import { supabase } from '@/lib/supabaseClient';
import { readStoredString, removeStoredValue, writeStoredString } from '@/lib/browserStorage';

const PUSH_VAPID_KEY_STORAGE = 'peekalisting:push:vapid-key';

function configuredPublicKey() {
  const explicit = String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
  return explicit;
}

function applicationServerKey() {
  const value = configuredPublicKey();
  if (!value) throw new Error('Web Push is not configured for this deployment.');
  return value;
}

function rememberedVapidKey() {
  return readStoredString('local', PUSH_VAPID_KEY_STORAGE, '') || '';
}

function rememberVapidKey(value) {
  writeStoredString('local', PUSH_VAPID_KEY_STORAGE, value);
}

function forgetVapidKey() {
  removeStoredValue('local', PUSH_VAPID_KEY_STORAGE);
}

async function disableSubscriptionBestEffort(endpoint) {
  try {
    await supabase.rpc('disable_web_push_subscription', { p_endpoint: endpoint });
  } catch {
    // The browser subscription can still be replaced if the old account or
    // endpoint is no longer available to the current authenticated session.
  }
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function platformLabel() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios-pwa';
  if (/android/.test(ua)) return 'android-pwa';
  return 'web-pwa';
}

export function webPushSupport() {
  const supported = Boolean(
    window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window,
  );
  const standalone = Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true,
  );
  return {
    supported,
    configured: Boolean(configuredPublicKey()),
    standalone,
    permission: supported ? Notification.permission : 'unsupported',
  };
}

export async function getCurrentPushSubscription() {
  if (!webPushSupport().supported) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const currentKey = configuredPublicKey();
  // Treat a subscription created with a previous deployment key as inactive
  // in Settings. The next explicit enable action will replace it safely.
  if (subscription && currentKey && rememberedVapidKey() !== currentKey) return null;
  return subscription;
}

export async function enableWebPush() {
  const support = webPushSupport();
  if (!support.supported) throw new Error('Push notifications are not supported on this device.');
  if (!support.configured) throw new Error('Push notifications are not configured for this deployment.');
  if (!support.standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    throw new Error('On iPhone or iPad, add PeekaListing to your Home Screen before enabling notifications.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const currentKey = applicationServerKey();

  // A PushSubscription is bound to the VAPID public key used to create it.
  // During a controlled key rotation, or after storage was cleared, replace
  // the old browser subscription before registering the new one. This keeps
  // background delivery working instead of leaving a stale endpoint behind.
  if (subscription && rememberedVapidKey() !== currentKey) {
    await disableSubscriptionBestEffort(subscription.endpoint);
    await subscription.unsubscribe().catch(() => false);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(currentKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    await subscription.unsubscribe().catch(() => false);
    throw new Error('The browser returned an incomplete push subscription.');
  }

  const { error } = await supabase.rpc('register_web_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
    p_platform: platformLabel(),
  });
  if (error) {
    await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  rememberVapidKey(currentKey);
  return subscription;
}

export async function disableWebPush() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  const { error } = await supabase.rpc('disable_web_push_subscription', {
    p_endpoint: subscription.endpoint,
  });
  if (error) throw error;
  await subscription.unsubscribe();
  forgetVapidKey();
}

export async function getWebPushPreferences() {
  const { data, error } = await supabase.rpc('get_web_push_notification_preferences');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    messages: row?.messages !== false,
    peekActivity: row?.peek_activity !== false,
    listingActivity: row?.listing_activity !== false,
    businessActivity: row?.business_activity !== false,
    moderation: row?.moderation !== false,
  };
}

export async function updateWebPushPreferences(preferences) {
  const { data, error } = await supabase.rpc('update_web_push_notification_preferences', {
    p_messages: Boolean(preferences.messages),
    p_peek_activity: Boolean(preferences.peekActivity),
    p_listing_activity: Boolean(preferences.listingActivity),
    p_business_activity: Boolean(preferences.businessActivity),
    p_moderation: Boolean(preferences.moderation),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    messages: row?.messages !== false,
    peekActivity: row?.peek_activity !== false,
    listingActivity: row?.listing_activity !== false,
    businessActivity: row?.business_activity !== false,
    moderation: row?.moderation !== false,
  };
}
