const UUID_PART = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const SAFE_PATH = new RegExp(
  `^(?:/(?:notifications|my-listings|profile|settings|chats|saved|post|peek-requests)|/peek-requests\\?request=${UUID_PART}|/(?:chats|messages)/${UUID_PART}|/(?:property|car|machinery|service)/${UUID_PART}(?:\\?responsePeek=${UUID_PART})?(?:#peek-threads)?)$`,
  'i',
);
const UUID = new RegExp(`^${UUID_PART}$`, 'i');

export const DEFAULT_NOTIFICATION_PATH = '/notifications';

export function safeNotificationPath(value, origin = 'https://peekalisting.invalid') {
  if (typeof value !== 'string') return DEFAULT_NOTIFICATION_PATH;
  const candidate = value.trim();
  if (!candidate || candidate.startsWith('//') || !candidate.startsWith('/')) return DEFAULT_NOTIFICATION_PATH;
  try {
    const parsed = new URL(candidate, origin);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.origin !== origin || parsed.username || parsed.password || !SAFE_PATH.test(path)) return DEFAULT_NOTIFICATION_PATH;
    return path;
  } catch {
    return DEFAULT_NOTIFICATION_PATH;
  }
}

function text(value, fallback, maximum) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (normalized || fallback).slice(0, maximum);
}

export function normalizePushPayload(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? /** @type {Record<string, unknown>} */ (input)
    : {};
  const type = text(source.type, 'account', 80);
  const alertId = typeof source.alertId === 'string' && UUID.test(source.alertId.trim())
    ? source.alertId.trim().toLowerCase()
    : null;
  return {
    title: text(source.title, 'PeekaListing', 80),
    body: type === 'message_received'
      ? 'You have a new message in PeekaListing.'
      : text(source.body ?? source.message, 'You have a new PeekaListing update.', 180),
    url: safeNotificationPath(source.url ?? source.link),
    alertId,
    type,
    tag: text(source.tag, alertId || 'peekalisting', 120),
  };
}

export function normalizePushSubscriptionData(input = {}) {
  const source = input && typeof input === 'object'
    ? /** @type {Record<string, unknown>} */ (input)
    : {};
  const endpoint = typeof source.endpoint === 'string' ? source.endpoint.trim() : '';
  const keys = source.keys && typeof source.keys === 'object'
    ? /** @type {Record<string, unknown>} */ (source.keys)
    : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 2048 || p256dh.length < 20 || auth.length < 8) {
    throw new TypeError('Push subscription data is invalid');
  }
  return { endpoint, p256dh, auth };
}

export function classifyPushPermission({ supported = false, configured = false, permission = 'unsupported', subscribed = false } = {}) {
  if (!supported) return 'unsupported';
  if (!configured) return 'not-configured';
  if (permission === 'denied') return 'denied';
  if (subscribed) return 'active';
  if (permission === 'granted') return 'granted-not-subscribed';
  return 'not-requested';
}
