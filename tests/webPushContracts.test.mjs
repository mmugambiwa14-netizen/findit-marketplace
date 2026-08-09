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
  migration: 'supabase/migrations/20260809194000_web_push_delivery.sql',
  delivery: 'supabase/functions/web-push-dispatch/index.ts',
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

test('foreground experience consumes canonical app alerts with deduplication, badge and sound', async () => {
  const [sound, foreground, settings] = await Promise.all([
    read(files.sound), read(files.foreground), read(files.settings),
  ]);
  assert.match(sound, /notificationSoundEnabled/);
  assert.match(sound, /MIN_GAP_MS/);
  assert.match(foreground, /table:\s*'app_alerts'/);
  assert.match(foreground, /seenRef/);
  assert.match(foreground, /setAppBadge/);
  assert.match(foreground, /postgres_changes/);
  assert.match(settings, /In-app notification sound/);
  assert.match(settings, /onCheckedChange={toggleSound}/);
});

test('push migration upgrades existing subscriptions and delivery jobs in place', async () => {
  const migration = await read(files.migration);
  assert.match(migration, /alter table public\.web_push_subscriptions/i);
  assert.match(migration, /alter table public\.web_push_delivery_jobs/i);
  assert.match(migration, /public\.app_alerts/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /attempts >= 5/);
  assert.match(migration, /status='pending'/);
  assert.match(migration, /then 'partial'/);
  assert.match(migration, /alter publication supabase_realtime add table public\.app_alerts/i);
  assert.doesNotMatch(migration, /web_push_delivery_outbox/);
  assert.doesNotMatch(migration, /\bactive\b/);
});

test('worker RPCs are service-role only', async () => {
  const migration = await read(files.migration);
  assert.match(migration, /revoke all on function public\.claim_web_push_deliveries.*authenticated/s);
  assert.match(migration, /grant execute on function public\.claim_web_push_deliveries\(integer\) to service_role/);
  assert.match(migration, /grant execute on function public\.complete_web_push_delivery.*service_role/s);
});

test('canonical dispatch worker is secret protected and reports per-device results', async () => {
  const delivery = await read(files.delivery);
  assert.match(delivery, /PUSH_DISPATCH_TOKEN/);
  assert.match(delivery, /WEB_PUSH_PRIVATE_KEY/);
  assert.match(delivery, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(delivery, /record_web_push_subscription_result/);
  assert.match(delivery, /p_delivered_count/);
  assert.match(delivery, /p_failed_count/);
  assert.match(delivery, /complete_web_push_delivery/);
});
