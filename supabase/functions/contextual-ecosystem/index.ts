import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { configuredAdminKey } from "../_shared/tour-runtime.ts";
import { BODY_INVALID, BODY_TOO_LARGE, readBoundedJson } from "../_shared/request-guards.ts";

const JOURNEY_STAGES = new Set(["discover", "evaluate", "prepare", "transact", "own"]);
const REQUEST_TIMEOUT_MS = 900;
const MAXIMUM_REQUEST_BYTES = 2048;

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const configured = (Deno.env.get("FINDIT_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (Deno.env.get("DENO_ENV") !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

// Only a complete, non-degraded plan may be retained by a shared cache. Caching a
// rejected request or a fail-soft empty plan would amplify a transient outage for
// the whole cache window after the database has already recovered.
const CACHEABLE_PLAN = "public, max-age=30, stale-while-revalidate=120";

function headers(request: Request, cacheControl: string = "no-store"): HeadersInit {
  const origin = allowedOrigin(request);
  return {
    "Content-Type": "application/json",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    ...(origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    } : {}),
  };
}

function json(request: Request, status: number, body: Record<string, unknown>, cacheControl?: string): Response {
  return Response.json(body, { status, headers: headers(request, cacheControl) });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function degraded(correlationId: string, reason: string, subjectListingId: string | null = null): Record<string, unknown> {
  return {
    contractVersion: 2,
    correlationId,
    subjectListingId,
    sections: [],
    degraded: true,
    reason,
  };
}

Deno.serve(async (request: Request) => {
  const correlationId = crypto.randomUUID();

  if (request.method === "OPTIONS") {
    if (!allowedOrigin(request)) return new Response(null, { status: 403, headers: headers(request) });
    return new Response(null, { status: 204, headers: headers(request) });
  }
  if (request.method !== "POST") return json(request, 405, { code: "method_not_allowed", correlationId });
  if (request.headers.get("origin") && !allowedOrigin(request)) return json(request, 403, { code: "origin_not_allowed", correlationId });
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json(request, 415, { code: "unsupported_media_type", correlationId });
  }
  // Bound what is actually buffered rather than trusting a header a chunked
  // request can omit.
  const parsed = await readBoundedJson(request, MAXIMUM_REQUEST_BYTES);
  if (parsed === BODY_TOO_LARGE) return json(request, 413, { code: "payload_too_large", correlationId });
  if (parsed === BODY_INVALID || !parsed || typeof parsed !== "object") {
    return json(request, 400, { code: "invalid_json", correlationId });
  }
  const body = parsed as { subjectListingId?: unknown; journeyStage?: unknown; maxSections?: unknown };

  if (!validUuid(body.subjectListingId)) return json(request, 400, { code: "invalid_subject", correlationId });
  if (body.journeyStage !== undefined && (typeof body.journeyStage !== "string" || !JOURNEY_STAGES.has(body.journeyStage))) {
    return json(request, 400, { code: "invalid_journey_stage", correlationId });
  }
  const maxSections = body.maxSections === undefined ? 6 : body.maxSections;
  if (typeof maxSections !== "number" || !Number.isInteger(maxSections) || maxSections < 1 || maxSections > 12) {
    return json(request, 400, { code: "invalid_section_limit", correlationId });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("Missing SUPABASE_URL");
    const client = createClient(url, configuredAdminKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let data: unknown;
    let error: unknown;
    try {
      ({ data, error } = await client.rpc("contextual_ecosystem_plan_v1", {
        p_subject_listing_id: body.subjectListingId,
        p_journey_stage: body.journeyStage ?? null,
        p_max_sections: maxSections,
      }).abortSignal(controller.signal));
    } finally {
      clearTimeout(timeout);
    }
    if (error || !data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).sections)) {
      return json(request, 200, degraded(correlationId, "service_unavailable", body.subjectListingId));
    }
    return json(request, 200, { ...(data as Record<string, unknown>), correlationId }, CACHEABLE_PLAN);
  } catch (error) {
    console.error("contextual ecosystem unavailable", { correlationId, error });
    return json(request, 200, degraded(correlationId, error instanceof DOMException && error.name === "AbortError" ? "timeout" : "service_unavailable", body.subjectListingId));
  }
});
