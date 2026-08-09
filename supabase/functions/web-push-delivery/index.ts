import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function safeLink(value: unknown) {
  const link = typeof value === 'string' ? value.trim() : '';
  if (!link.startsWith('/') || link.startsWith('//') || link.includes('://')) return '/notifications';
  return link.slice(0, 500);
}

function safeText(value: unknown, fallback: string, max: number) {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  return (text || fallback).slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const workerSecret = env('FINDIT_WEB_PUSH_WORKER_SECRET');
    if (request.headers.get('authorization') !== `Bearer ${workerSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    webpush.setVapidDetails(
      env('FINDIT_WEB_PUSH_VAPID_SUBJECT'),
      env('FINDIT_WEB_PUSH_VAPID_PUBLIC_KEY'),
      env('FINDIT_WEB_PUSH_VAPID_PRIVATE_KEY'),
    );

    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body?.limit ?? 25);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25;

    const { data: deliveries, error: claimError } = await client.rpc('claim_web_push_deliveries', { p_limit: limit });
    if (claimError) throw claimError;

    let delivered = 0;
    let failed = 0;
    let invalidated = 0;

    for (const delivery of deliveries ?? []) {
      const subscriptions = Array.isArray(delivery.subscriptions) ? delivery.subscriptions : [];
      let successfulDevices = 0;
      const errors: string[] = [];

      const payload = JSON.stringify({
        notificationId: delivery.notification_id,
        type: safeText(delivery.event_type, 'account_update', 80),
        title: safeText(delivery.title, 'PeekaListing update', 120),
        body: safeText(delivery.body, 'You have a new PeekaListing notification.', 220),
        link: safeLink(delivery.link),
        tag: `peekalisting-${delivery.notification_id}`,
        timestamp: delivery.created_at,
      });

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, payload, { TTL: 60 * 60 * 24, urgency: 'normal' });
          successfulDevices += 1;
          await client.rpc('record_web_push_subscription_result', {
            p_subscription_id: subscription.id,
            p_success: true,
            p_permanent_failure: false,
          });
        } catch (error) {
          const status = Number((error as { statusCode?: number })?.statusCode ?? 0);
          const permanent = status === 404 || status === 410;
          if (permanent) invalidated += 1;
          errors.push(`${status || 'error'}:${String((error as Error)?.message ?? error).slice(0, 180)}`);
          await client.rpc('record_web_push_subscription_result', {
            p_subscription_id: subscription.id,
            p_success: false,
            p_permanent_failure: permanent,
          });
        }
      }

      const complete = subscriptions.length === 0 || successfulDevices > 0;
      const { error: completeError } = await client.rpc('complete_web_push_delivery', {
        p_delivery_id: delivery.delivery_id,
        p_lease_token: delivery.lease_token,
        p_delivered: complete,
        p_error: errors.join(' | ') || null,
      });
      if (completeError) throw completeError;
      if (complete) delivered += 1;
      else failed += 1;
    }

    return new Response(JSON.stringify({ claimed: deliveries?.length ?? 0, delivered, failed, invalidated }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('web-push-delivery failed', error);
    return new Response(JSON.stringify({ error: 'Web Push delivery failed.' }), { status: 500, headers: jsonHeaders });
  }
});
