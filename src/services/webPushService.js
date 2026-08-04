import { supabase } from '@/lib/supabaseClient';

const STAGING_PUBLIC_KEY = 'BLuirAxWgQ7PVQ2EyEORk_oSeN2N5jwwxBQjIM_5UrdHQmGoGFLZ_0zyDNcRQ0fInqZdgcH6_efeFy6tu478xJ4';

function applicationServerKey() {
  return String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || STAGING_PUBLIC_KEY).trim();
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
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  return { supported, standalone, permission: supported ? Notification.permission : 'unsupported' };
}

export async function getCurrentPushSubscription() {
  if (!webPushSupport().supported) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enableWebPush() {
  const support = webPushSupport();
  if (!support.supported) throw new Error('Push notifications are not supported on this device.');
  if (!support.standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    throw new Error('On iPhone or iPad, add FindIt to your Home Screen before enabling notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey()),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.rpc('register_web_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
    p_platform: platformLabel(),
  });
  if (error) throw error;
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
}
