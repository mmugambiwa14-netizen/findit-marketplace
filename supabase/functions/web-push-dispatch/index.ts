import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const LEASE_SECONDS = 120;
const DEFAULT_ICON = "/brand/peekalisting-icon-192.png";
const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SAFE_PATH = new RegExp(
  `^(?:/(?:notifications|my-listings|profile|settings|chats|saved|post|peek-requests)|/peek-requests\\?request=${UUID_PART}|/(?:chats|messages)/${UUID_PART}|/(?:property|car|machinery|service)/${UUID_PART}(?:\\?responsePeek=${UUID_PART})?(?:#peek-threads)?)$`,
  "i",
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function boundedText(value: unknown, fallback: string, maximum: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maximum);
}

function safeNotificationPath(value: unknown) {
  if (typeof value !== "string") return "/notifications";
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("//") || !candidate.startsWith("/")) {
    return "/notifications";
  }
  try {
    const parsed = new URL(candidate, "https://peekalisting.invalid");
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (parsed.username || parsed.password || parsed.origin !== "https://peekalisting.invalid" || !SAFE_PATH.test(path)) {
      return "/notifications";
    }
    return path;
  } catch {
    return "/notifications";
  }
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return typeof keys?.default === "string" ? keys.default : "";
  } catch {
    return "";
  }
}

function statusCode(error: unknown) {
  return Number((error as { statusCode?: number })?.statusCode || 0);
}

function errorText(error: unknown) {
  return boundedText(error instanceof Error ? error.message : String(error), "delivery_failed", 120);
}

function isPermanentSubscriptionFailure(code: number) {
  return code === 400 || code === 401 || code === 403 || code === 404 || code === 410;
}

type RpcClient = {
  rpc: (functionName: string, body: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function invoke(supabase: RpcClient, functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(functionName, body);
  if (error) throw new Error(`${functionName}: ${error.message}`);
  return data;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expectedToken = Deno.env.get("PUSH_DISPATCH_TOKEN") || "";
  const suppliedToken = request.headers.get("x-push-dispatch-token") || "";
  if (!expectedToken || suppliedToken !== expectedToken) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secretKey = serviceKey();
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY") || "";
  const subject = Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:support@peekalisting.com";
  if (!supabaseUrl || !secretKey || !publicKey || !privateKey) {
    return json({ error: "push_not_configured" }, 503);
  }

  let requestedBatchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && Number.isFinite(Number((body as { limit?: unknown }).limit))) {
      requestedBatchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.trunc(Number((body as { limit?: unknown }).limit))));
    }
  } catch {
    // An empty body is the normal scheduler invocation. Invalid JSON does not
    // need to prevent a bounded worker pass.
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    return json({ error: "push_not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let claims: Array<Record<string, unknown>>;
  try {
    const claimData = await invoke(supabase, "claim_web_push_delivery_attempts", {
      p_limit: requestedBatchSize,
      p_lease_seconds: LEASE_SECONDS,
    });
    claims = Array.isArray(claimData)
      ? claimData.filter(isRecord)
      : [];
  } catch (error) {
    return json({ error: "queue_claim_failed", detail: errorText(error) }, 500);
  }

  let delivered = 0;
  let failed = 0;

  for (const claim of claims) {
    const attemptId = Number(claim.attempt_id);
    const leaseToken = typeof claim.lease_token === "string" ? claim.lease_token : "";
    const subscriptionId = typeof claim.subscription_id === "string" ? claim.subscription_id : "";
    if (!Number.isInteger(attemptId) || !leaseToken || !subscriptionId) {
      failed += 1;
      continue;
    }

    const eventType = boundedText(claim.event_type, "account", 80);
    const body = eventType === "message_received"
      ? "You have a new message in PeekaListing."
      : boundedText(claim.message, "You have a new PeekaListing update.", 180);
    const payload = JSON.stringify({
      title: boundedText(claim.title, "PeekaListing", 80),
      body,
      url: safeNotificationPath(claim.link),
      alertId: typeof claim.alert_id === "string" ? claim.alert_id : null,
      type: eventType,
      tag: boundedText(claim.source_key, typeof claim.alert_id === "string" ? claim.alert_id : "peekalisting", 120),
      icon: DEFAULT_ICON,
      badge: "/brand/peekalisting-icon-64.png",
      timestamp: new Date().toISOString(),
    });

    try {
      await webpush.sendNotification({
        endpoint: String(claim.endpoint || ""),
        keys: { p256dh: String(claim.p256dh || ""), auth: String(claim.auth || "") },
      }, payload, { TTL: 300, urgency: "high" });
      await invoke(supabase, "complete_web_push_delivery_attempt", {
        p_attempt_id: attemptId,
        p_lease_token: leaseToken,
      });
      delivered += 1;
    } catch (error) {
      const code = statusCode(error);
      const message = errorText(error);
      try {
        if (isPermanentSubscriptionFailure(code)) {
          await invoke(supabase, "retire_web_push_subscription", {
            p_subscription_id: subscriptionId,
            p_reason: `push_${code || "invalid"}`,
          });
        } else {
          await invoke(supabase, "fail_web_push_delivery_attempt", {
            p_attempt_id: attemptId,
            p_lease_token: leaseToken,
            p_error_code: message,
            p_retryable: true,
          });
        }
      } catch (finalizeError) {
        console.error("Could not finalize push delivery attempt", errorText(finalizeError));
      }
      failed += 1;
    }
  }

  return json({ processed: claims.length, delivered, failed });
});
