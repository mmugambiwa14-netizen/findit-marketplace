import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {
  classifyPushPermission,
  normalizePushPayload,
  normalizePushSubscriptionData,
  safeNotificationPath,
} from '../src/services/pushContracts.js';

const pushWorkerSource = await readFile(new URL('../public/push-sw.js', import.meta.url), 'utf8');
const dispatcherSource = await readFile(new URL('../supabase/functions/web-push-dispatch/index.ts', import.meta.url), 'utf8');
const browserServiceSource = await readFile(new URL('../src/services/webPushService.js', import.meta.url), 'utf8');
const workflowSource = await readFile(new URL('../.github/workflows/maintenance-workers.yml', import.meta.url), 'utf8');
const functionConfigSource = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

function loadPushWorker({ windows = [] } = {}) {
  const listeners = new Map();
  const shown = [];
  const posted = [];
  const opened = [];
  const focused = [];
  const navigated = [];
  const context = {
    URL,
    console,
    self: {
      location: { origin: 'https://peekalisting.example', hostname: 'peekalisting.example' },
      addEventListener: (name, handler) => listeners.set(name, handler),
      registration: {
        showNotification: async (title, options) => shown.push({ title, options }),
        setAppBadge: async () => {},
      },
      clients: {
        matchAll: async () => windows,
        openWindow: async (url) => opened.push(url),
      },
      skipWaiting: async () => {},
    },
  };
  context.self.clients.matchAll = async () => windows;
  windows.forEach((client) => {
    client.postMessage = (message) => posted.push(message);
    client.focus = async () => focused.push(client);
    client.navigate = async (url) => navigated.push(url);
  });
  vm.createContext(context);
  vm.runInContext(pushWorkerSource, context);
  return { listeners, shown, posted, opened, focused, navigated };
}

function pushEvent(payload) {
  let pending;
  return {
    data: {
      json: () => payload,
      text: () => JSON.stringify(payload),
    },
    waitUntil: (promise) => { pending = promise; },
    done: async () => pending,
  };
}

test('push contracts reject unsafe deep links and normalize private message previews', () => {
  assert.equal(safeNotificationPath('https://evil.example/steal'), '/notifications');
  assert.equal(safeNotificationPath('//evil.example/steal'), '/notifications');
  assert.equal(safeNotificationPath('/chats/94000000-0000-4000-8000-000000000001'), '/chats/94000000-0000-4000-8000-000000000001');
  assert.deepEqual(
    normalizePushPayload({ type: 'message_received', body: 'private text', alertId: '94000000-0000-4000-8000-000000000001' }),
    {
      title: 'PeekaListing',
      body: 'You have a new message in PeekaListing.',
      url: '/notifications',
      alertId: '94000000-0000-4000-8000-000000000001',
      type: 'message_received',
      tag: '94000000-0000-4000-8000-000000000001',
    },
  );
});

test('subscription contracts require HTTPS endpoints and usable key material', () => {
  assert.deepEqual(
    normalizePushSubscriptionData({
      endpoint: 'https://push.example.test/device',
      keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(43) },
    }),
    { endpoint: 'https://push.example.test/device', p256dh: 'a'.repeat(87), auth: 'b'.repeat(43) },
  );
  assert.throws(() => normalizePushSubscriptionData({ endpoint: 'http://push.example.test/device', keys: {} }));
});

test('permission state distinguishes unsupported, unconfigured, denied and active devices', () => {
  assert.equal(classifyPushPermission(), 'unsupported');
  assert.equal(classifyPushPermission({ supported: true }), 'not-configured');
  assert.equal(classifyPushPermission({ supported: true, configured: true, permission: 'denied' }), 'denied');
  assert.equal(classifyPushPermission({ supported: true, configured: true, permission: 'granted' }), 'granted-not-subscribed');
  assert.equal(classifyPushPermission({ supported: true, configured: true, permission: 'granted', subscribed: true }), 'active');
});

test('foreground push is handed to the visible app without a duplicate OS banner', async () => {
  const visible = { url: 'https://peekalisting.example/chats/94000000-0000-4000-8000-000000000001', visibilityState: 'visible' };
  const worker = loadPushWorker({ windows: [visible] });
  const event = pushEvent({ title: 'New message', body: 'private text', type: 'message_received', alertId: '94000000-0000-4000-8000-000000000001', url: '/chats/94000000-0000-4000-8000-000000000001' });
  worker.listeners.get('push')(event);
  await event.done();
  assert.equal(worker.shown.length, 0);
  assert.equal(worker.posted.length, 1);
  assert.equal(worker.posted[0].type, 'PUSH_NOTIFICATION');
  assert.equal(worker.posted[0].payload.body, 'You have a new message in PeekaListing.');
});

test('background push displays a defensive notification and strips external URLs', async () => {
  const worker = loadPushWorker();
  const event = pushEvent({ title: '<untrusted>', body: '<payload>', type: 'account', url: 'https://evil.example/redirect', icon: 'https://evil.example/icon.png' });
  worker.listeners.get('push')(event);
  await event.done();
  assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].options.data.url, '/notifications');
  assert.equal(worker.shown[0].options.icon, '/brand/peekalisting-icon-192.png');
});

test('notification clicks focus an existing app and use only safe same-origin paths', async () => {
  const existing = { url: 'https://peekalisting.example/', visibilityState: 'hidden' };
  const worker = loadPushWorker({ windows: [existing] });
  let pending;
  worker.listeners.get('notificationclick')({
    notification: { data: { url: 'https://evil.example/redirect' }, close: () => {} },
    waitUntil: (promise) => { pending = promise; },
  });
  await pending;
  assert.equal(worker.focused.length, 1);
  assert.equal(worker.navigated[0], 'https://peekalisting.example/notifications');
});

test('subscription changes are handed to authenticated app clients for resync', async () => {
  const visible = { url: 'https://peekalisting.example/', visibilityState: 'visible' };
  const worker = loadPushWorker({ windows: [visible] });
  let pending;
  worker.listeners.get('pushsubscriptionchange')({
    newSubscription: { toJSON: () => ({ endpoint: 'https://push.example.test/device', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(43) } }) },
    waitUntil: (promise) => { pending = promise; },
  });
  await pending;
  assert.equal(worker.posted[0].type, 'PUSH_SUBSCRIPTION_CHANGED');
  assert.equal(worker.posted[0].subscription.endpoint, 'https://push.example.test/device');
});

test('browser service uses only the public VAPID key and fails honestly when it is absent', () => {
  assert.match(browserServiceSource, /VITE_WEB_PUSH_PUBLIC_KEY/);
  assert.doesNotMatch(browserServiceSource, /STAGING_PUBLIC_KEY|BLuirAx/);
  assert.doesNotMatch(browserServiceSource, /VITE_WEB_PUSH_PRIVATE_KEY|SUPABASE_SERVICE_ROLE_KEY|PUSH_DISPATCH_TOKEN/);
  assert.match(browserServiceSource, /Notification\.requestPermission/);
  assert.match(browserServiceSource, /not configured on this deployment/);
});

test('settings keeps push permission explanation-first and sound foreground-only', async () => {
  const settings = await readFile(new URL('../src/components/settings/PushNotificationSettings.jsx', import.meta.url), 'utf8');
  const sound = await readFile(new URL('../src/components/settings/NotificationSoundSettings.jsx', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/components/notifications/PushNotificationRuntime.jsx', import.meta.url), 'utf8');
  assert.match(settings, /setExplanationOpen\(true\)/);
  assert.match(settings, /Continue and allow notifications/);
  assert.match(settings, /preferencesQuery\.error/);
  assert.match(sound, /inAppSoundEnabled/);
  assert.match(sound, /playNotificationTone/);
  assert.match(runtime, /PUSH_NOTIFICATION/);
  assert.match(runtime, /inAppSoundEnabled !== false/);
});

test('trusted dispatcher uses server-only VAPID secrets, durable RPC claims and bounded retry handling', () => {
  assert.match(dispatcherSource, /WEB_PUSH_PRIVATE_KEY/);
  assert.match(dispatcherSource, /claim_web_push_delivery_attempts/);
  assert.match(dispatcherSource, /complete_web_push_delivery_attempt/);
  assert.match(dispatcherSource, /fail_web_push_delivery_attempt/);
  assert.match(dispatcherSource, /retire_web_push_subscription/);
  assert.match(dispatcherSource, /You have a new message in PeekaListing/);
  assert.match(dispatcherSource, /code === 404.*code === 410/s);
  assert.match(dispatcherSource, /constantTimeEqual/);
  assert.doesNotMatch(dispatcherSource, /suppliedToken\s*!==\s*expectedToken/);
  assert.doesNotMatch(dispatcherSource, /VITE_WEB_PUSH_PRIVATE_KEY/);
});

test('Web Push scheduling is explicit, disabled by default and uses the custom token boundary', async () => {
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const validator = await readFile(new URL('../scripts/validate-env.mjs', import.meta.url), 'utf8');
  assert.match(example, /FINDIT_WEB_PUSH_WORKERS_ENABLED=false/);
  assert.match(workflowSource, /web-push-dispatch:/);
  assert.match(workflowSource, /vars\.FINDIT_WEB_PUSH_WORKERS_ENABLED == 'true'/);
  assert.match(workflowSource, /x-push-dispatch-token/);
  assert.match(functionConfigSource, /\[functions\.web-push-dispatch\]/);
  assert.match(functionConfigSource, /verify_jwt = false/);
  assert.match(validator, /PUSH_DISPATCH_TOKEN is required when Web Push workers are enabled/);
});
