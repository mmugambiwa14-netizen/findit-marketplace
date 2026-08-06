import { supabase } from '@/lib/supabaseClient';

function applicationServerKey() {
  // Every deployment supplies its own VAPID public key through the environment.
  // There is deliberately no in-source fallback, mirroring src/lib/supabaseClient.js.
  //
  // A previous revision fell back to a hardcoded staging key. That put key
  // material in git, and worse, it failed silently: a production build with the
  // variable unset would encrypt every push subscription against staging's
  // keypair, so the production dispatcher -- holding a different private key --
  // could never deliver to those subscribers. The UI would report "enabled"
  // while nothing ever arrived. Fail closed instead: subscribing without a
  // configured key throws, and the caller surfaces it to the user.
  const key = String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY ?? '').trim();
  if (!key) {
    throw new Error('Push notifications are not configured for this deployment yet.');
  }
  return key;
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
