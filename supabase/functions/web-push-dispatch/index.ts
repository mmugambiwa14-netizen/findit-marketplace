import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const headers = { "content-type": "application/json", "cache-control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function safeText(value: unknown, fallback: string, max: number) {
  const text = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function safeLink(value: unknown) {
  const link = typeof value === "string" ? value.trim() : "";
  if (!link.startsWith("/") || link.startsWith("//") || link.includes("://")) return "/notifications";
  return link.slice(0, 500);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedToken = Deno.env.get("PUSH_DISPATCH_TOKEN") || "";
  if (!expectedToken || request.headers.get("x-push-dispatch-token") !== expectedToken) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY") || "";
  const subject = Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:support@peekalisting.com";
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) return json({ error: "push_not_configured" }, 503);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await request.json().catch(() => ({}));
  const requestedLimit = Number(body?.limit ?? 25);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25;

  const { data: jobs, error: claimError } = await supabase.rpc("claim_web_push_deliveries", { p_limit: limit });
  if (claimError) return json({ error: "queue_claim_failed", detail: claimError.message }, 500);

  let deliveredJobs = 0;
  let partialJobs = 0;
  let failedJobs = 0;
  let deliveredDevices = 0;
  let failedDevices = 0;
  let invalidatedSubscriptions = 0;

  for (const job of jobs || []) {
    const subscriptions = Array.isArray(job.subscriptions) ? job.subscriptions : [];
    let delivered = 0;
    let failed = 0;
    const errors: string[] = [];

    const payload = JSON.stringify({
      notificationId: job.notification_id,
      title: safeText(job.title, "PeekaListing update", 120),
      body: safeText(job.body, "You have a new PeekaListing notification.", 220),
      link: safeLink(job.link),
      type: safeText(job.event_type, "account_status", 80),
      tag: `peekalisting-${job.notification_id}`,
      timestamp: job.created_at,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 * 60 * 24, urgency: "normal" });
        delivered += 1;
        deliveredDevices += 1;
        await supabase.rpc("record_web_push_subscription_result", {
          p_subscription_id: subscription.id,
          p_success: true,
          p_permanent_failure: false,
        });
      } catch (error) {
        failed += 1;
        failedDevices += 1;
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        const permanent = statusCode === 404 || statusCode === 410;
        if (permanent) invalidatedSubscriptions += 1;
        errors.push(`${statusCode || "error"}:${String(error instanceof Error ? error.message : error).slice(0, 180)}`);
        await supabase.rpc("record_web_push_subscription_result", {
          p_subscription_id: subscription.id,
          p_success: false,
          p_permanent_failure: permanent,
        });
      }
    }

    // No active subscription is terminal at the push layer. The canonical
    // in-app alert is still retained, so retrying an empty fan-out adds no value.
    const complete = subscriptions.length === 0 || delivered > 0;
    const { error: completeError } = await supabase.rpc("complete_web_push_delivery", {
      p_delivery_id: job.delivery_id,
      p_lease_token: job.lease_token,
      p_delivered: complete,
      p_delivered_count: delivered,
      p_failed_count: failed,
      p_error: errors.join(" | ") || null,
    });
    if (completeError) return json({ error: "queue_complete_failed", detail: completeError.message }, 500);

    if (delivered > 0 && failed > 0) partialJobs += 1;
    else if (complete) deliveredJobs += 1;
    else failedJobs += 1;
  }

  return json({
    processed: jobs?.length || 0,
    deliveredJobs,
    partialJobs,
    failedJobs,
    deliveredDevices,
    failedDevices,
    invalidatedSubscriptions,
  });
});
