import { supabase } from '@/lib/supabaseClient';
import { normalizePushSubscriptionData } from '@/services/pushContracts';

const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{60,160}$/;

function browserAvailable() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function applicationServerKey() {
  return String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();
}

function urlBase64ToUint8Array(value) {
  if (!PUBLIC_KEY_PATTERN.test(value)) throw new Error('Web Push is not configured for this deployment.');
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

function isIos() {
  return browserAvailable() && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (!browserAvailable()) return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.matchMedia?.('(display-mode: minimal-ui)')?.matches
      || navigator.standalone === true,
  );
}

export function webPushSupport() {
  const supported = Boolean(
    browserAvailable()
      && window.isSecureContext
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
  );
  const configured = PUBLIC_KEY_PATTERN.test(applicationServerKey());
  return {
    supported,
    configured,
    standalone: isStandalone(),
    ios: isIos(),
    permission: supported ? Notification.permission : 'unsupported',
  };
}

async function serviceWorkerRegistration() {
  if (!webPushSupport().supported) return null;
  // A browser can expose PushManager while a registration is still blocked or
  // pending. Do not leave Settings in an endless loading state in that case.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(null), 5000)),
  ]);
}

export async function getCurrentPushSubscription() {
  const registration = await serviceWorkerRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

async function registerSubscriptionData(data) {
  const normalized = normalizePushSubscriptionData(data);
  const { error } = await supabase.rpc('register_web_push_subscription', {
    p_endpoint: normalized.endpoint,
    p_p256dh: normalized.p256dh,
    p_auth: normalized.auth,
    p_user_agent: browserAvailable() ? navigator.userAgent : null,
    p_platform: browserAvailable() ? platformLabel() : 'web',
  });
  if (error) throw error;
  return normalized;
}

export async function syncWebPushSubscription(subscription) {
  if (!subscription) throw new Error('No push subscription is available.');
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  return registerSubscriptionData(json);
}

export async function requestWebPushPermission() {
  const support = webPushSupport();
  if (!support.supported) throw new Error('Push notifications are not supported on this device.');
  if (!support.configured) throw new Error('Push notifications are not configured on this deployment yet.');
  if (support.ios && !support.standalone) {
    throw new Error('On iPhone or iPad, add PeekaListing to your Home Screen before enabling notifications.');
  }
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked in your device settings.');
  if (Notification.permission === 'granted') return 'granted';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  return permission;
}

export async function enableWebPush() {
  await requestWebPushPermission();
  const registration = await serviceWorkerRegistration();
  if (!registration) throw new Error('The PeekaListing service worker is not ready yet.');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey()),
    });
  }
  await syncWebPushSubscription(subscription);
  return subscription;
}

export async function syncWebPushSubscriptionData(data) {
  return registerSubscriptionData(data);
}

export async function disableWebPush() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  let remoteError = null;
  try {
    const { error } = await supabase.rpc('disable_web_push_subscription', {
      p_endpoint: subscription.endpoint,
    });
    remoteError = error || null;
  } catch (error) {
    remoteError = error;
  }

  // The browser subscription belongs to this installation. Always remove it
  // locally even if the authenticated cleanup RPC is unavailable (for
  // example, during logout after a token has expired), otherwise the next
  // account using this browser can inherit a stale endpoint.
  let localError = null;
  try {
    await subscription.unsubscribe();
  } catch (error) {
    localError = error;
  }

  if (remoteError) throw remoteError;
  if (localError) throw localError;
}
