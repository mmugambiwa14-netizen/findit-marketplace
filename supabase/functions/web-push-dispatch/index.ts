import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedToken = Deno.env.get("PUSH_DISPATCH_TOKEN") || "";
  const suppliedToken = request.headers.get("x-push-dispatch-token") || "";
  if (!expectedToken || suppliedToken !== expectedToken) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY") || "";
  const subject = Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:support@findit.market";
  if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey) {
    return json({ error: "push_not_configured" }, 503);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: jobs, error: jobsError } = await supabase
    .from("web_push_delivery_jobs")
    .select("id, alert_id, user_id, attempts")
    .in("status", ["pending", "failed"])
    .lte("available_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(25);
  if (jobsError) return json({ error: "queue_read_failed", detail: jobsError.message }, 500);
  if (!jobs?.length) return json({ processed: 0, delivered: 0, failed: 0 });

  let deliveredTotal = 0;
  let failedTotal = 0;

  for (const job of jobs) {
    const lockedAt = new Date().toISOString();
    const { data: locked } = await supabase
      .from("web_push_delivery_jobs")
      .update({ status: "processing", locked_at: lockedAt, attempts: Number(job.attempts || 0) + 1, updated_at: lockedAt })
      .eq("id", job.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!locked) continue;

    const [{ data: alert, error: alertError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      supabase.from("app_alerts").select("id,title,message,type,link,event_type,source_key").eq("id", job.alert_id).maybeSingle(),
      supabase.from("web_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", job.user_id).eq("enabled", true),
    ]);

    if (alertError || subscriptionError || !alert) {
      const message = alertError?.message || subscriptionError?.message || "alert_not_found";
      await supabase.from("web_push_delivery_jobs").update({
        status: "failed", last_error: message, available_at: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      failedTotal += 1;
      continue;
    }

    let delivered = 0;
    let failed = 0;
    let lastError = "";
    const payload = JSON.stringify({
      title: alert.title,
      body: alert.message,
      url: alert.link || "/notifications",
      alertId: alert.id,
      type: alert.event_type || alert.type || "account",
      tag: alert.source_key || alert.id,
      icon: "/brand/findit-icon-192.png",
      badge: "/brand/findit-icon-192.png",
    });

    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 300, urgency: "high" });
        delivered += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        lastError = error instanceof Error ? error.message : String(error);
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("web_push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", subscription.id);
        }
      }
    }

    const status = delivered > 0 ? (failed > 0 ? "partial" : "delivered") : "failed";
    await supabase.from("web_push_delivery_jobs").update({
      status,
      delivered_count: delivered,
      failed_count: failed,
      last_error: lastError || null,
      available_at: status === "failed" ? new Date(Date.now() + 5 * 60_000).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    deliveredTotal += delivered;
    failedTotal += failed;
  }

  return json({ processed: jobs.length, delivered: deliveredTotal, failed: failedTotal });
});
