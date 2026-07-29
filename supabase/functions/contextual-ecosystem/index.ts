import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const JOURNEY_STAGES = new Set(["discover", "evaluate", "prepare", "transact", "own"]);
const REQUEST_TIMEOUT_MS = 900;

function configuredAdminKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const serialized = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (serialized) {
    const values = JSON.parse(serialized) as Record<string, string>;
    const value = values.default ?? Object.values(values)[0];
    if (value) return value;
  }
  throw new Error("Missing Supabase service credential");
}

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

function headers(request: Request): HeadersInit {
  const origin = allowedOrigin(request);
  return {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    ...(origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    } : {}),
  };
}

function json(request: Request, status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: headers(request) });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function degraded(correlationId: string, reason: string, subjectListingId: string | null = null): Record<string, unknown> {
  return {
    contractVersion: 1,
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
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return json(request, 413, { code: "payload_too_large", correlationId });

  let body: { subjectListingId?: unknown; journeyStage?: unknown; maxSections?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(request, 400, { code: "invalid_json", correlationId });
  }

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
    const rpc = client.rpc("contextual_ecosystem_plan_v1", {
      p_subject_listing_id: body.subjectListingId,
      p_journey_stage: body.journeyStage ?? null,
      p_max_sections: maxSections,
    }, { signal: controller.signal });
    const { data, error } = await rpc;
    clearTimeout(timeout);
    if (error || !data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).sections)) {
      return json(request, 200, degraded(correlationId, "service_unavailable", body.subjectListingId));
    }
    return json(request, 200, { ...(data as Record<string, unknown>), correlationId });
  } catch (error) {
    console.error("contextual ecosystem unavailable", { correlationId, error });
    return json(request, 200, degraded(correlationId, error instanceof DOMException && error.name === "AbortError" ? "timeout" : "service_unavailable", body.subjectListingId));
  }
});
