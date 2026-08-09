import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const files = {
  env: '.env.example',
  service: 'src/services/webPushService.js',
  sound: 'src/services/notificationSoundService.js',
  foreground: 'src/components/notifications/ForegroundNotificationListener.jsx',
  settings: 'src/components/settings/PushNotificationSettings.jsx',
  worker: 'public/sw.js',
  preflight: 'supabase/migrations/20260809193500_web_push_preflight.sql',
  migration: 'supabase/migrations/20260809194000_web_push_delivery.sql',
  wrappers: 'supabase/migrations/20260809194500_web_push_delivery_rpc_wrappers.sql',
  hardening: 'supabase/migrations/20260809195000_web_push_hardening.sql',
  delivery: 'supabase/functions/web-push-delivery/index.ts',
};

test('browser receives only public VAPID configuration', async () => {
  const [env, service] = await Promise.all([read(files.env), read(files.service)]);
  assert.match(env, /^VITE_WEB_PUSH_PUBLIC_KEY=/m);
  assert.doesNotMatch(env, /^VITE_.*PRIVATE.*VAPID/im);
  assert.doesNotMatch(service, /STAGING_PUBLIC_KEY/);
  assert.match(service, /VITE_WEB_PUSH_PUBLIC_KEY/);
});

test('service worker implements user-visible push and safe click routing', async () => {
  const worker = await read(files.worker);
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /startsWith\('\/\/'\)/);
  assert.match(worker, /clients\.openWindow/);
  assert.match(worker, /silent:\s*false/);
});

test('foreground experience has deduplication, badge and user-controlled sound', async () => {
  const [sound, foreground, settings] = await Promise.all([
    read(files.sound), read(files.foreground), read(files.settings),
  ]);
  assert.match(sound, /notificationSoundEnabled/);
  assert.match(sound, /MIN_GAP_MS/);
  assert.match(foreground, /seenRef/);
  assert.match(foreground, /setAppBadge/);
  assert.match(foreground, /postgres_changes/);
  assert.match(settings, /In-app notification sound/);
  assert.match(settings, /onCheckedChange={toggleSound}/);
});

test('push schema converges partial installs before durable delivery', async () => {
  const [preflight, migration, hardening] = await Promise.all([
    read(files.preflight), read(files.migration), read(files.hardening),
  ]);
  assert.match(preflight, /create table if not exists public\.web_push_subscriptions/i);
  assert.match(preflight, /drop policy if exists web_push_subscriptions_own_select/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /private\.web_push_delivery_outbox/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /attempt_count >= 5/);
  assert.match(hardening, /alter publication supabase_realtime add table public\.notifications/i);
});

test('worker RPCs are service-role only', async () => {
  const wrappers = await read(files.wrappers);
  assert.match(wrappers, /revoke all on function public\.claim_web_push_deliveries.*authenticated/s);
  assert.match(wrappers, /grant execute on function public\.claim_web_push_deliveries\(integer\) to service_role/);
  assert.match(wrappers, /grant execute on function public\.complete_web_push_delivery.*service_role/s);
});

test('delivery worker requires dedicated secret and invalidates dead endpoints', async () => {
  const delivery = await read(files.delivery);
  assert.match(delivery, /FINDIT_WEB_PUSH_WORKER_SECRET/);
  assert.match(delivery, /FINDIT_WEB_PUSH_VAPID_PRIVATE_KEY/);
  assert.match(delivery, /status === 404 \|\| status === 410/);
  assert.match(delivery, /record_web_push_subscription_result/);
  assert.match(delivery, /complete_web_push_delivery/);
});
