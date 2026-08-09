import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.7";

const DEFAULT_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://staging.peekalisting.com",
  "https://staging.peekalisting.pages.dev",
] as const;

export const TOUR_LIMITS = Object.freeze({
  maxDurationSeconds: 120,
  maxSourceBytes: 262_144_000,
  maxRequestBytes: 65_536,
  signedUploadLifetimeSeconds: 1800,
  signedPlaybackLifetimeSeconds: 300,
  signedCardAssetLifetimeSeconds: 3600,
});

export const TOUR_MIME_EXTENSIONS = Object.freeze<Record<string, string>>({
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
});

export function toursBackendEnabled(): boolean {
  if (Deno.env.get("TOURS_BACKEND_ENABLED") === "true") return true;
  return Deno.env.get("SUPABASE_URL") === "http://kong:8000"
    && Deno.env.get("TOURS_BACKEND_ENABLED") !== "false";
}

export function configuredKey(name: string, legacyName: string): string {
  const direct = Deno.env.get(name) ?? Deno.env.get(legacyName);
  if (direct) return direct;
  const pluralName = name.endsWith("SECRET_KEY")
    ? "SUPABASE_SECRET_KEYS"
    : "SUPABASE_PUBLISHABLE_KEYS";
  const serialized = Deno.env.get(pluralName);
  if (serialized) {
    const values = JSON.parse(serialized) as Record<string, string>;
    const value = values.default ?? Object.values(values)[0];
    if (value) return value;
  }
  throw new Error(`Missing ${name}`);
}

export function configuredAdminKey(): string {
  return configuredKey("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
}

export function configuredPublishableKey(): string {
  return configuredKey("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
}

export function supabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("Missing SUPABASE_URL");
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), configuredAdminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(authorization: string): SupabaseClient {
  return createClient(supabaseUrl(), configuredPublishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicClient(): SupabaseClient {
  return createClient(supabaseUrl(), configuredPublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("FINDIT_ALLOWED_ORIGINS") ?? "").split(",");
  return new Set(
    [...DEFAULT_ORIGINS, ...configured]
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

function isLocalPreviewOrigin(origin: string): boolean {
  if (supabaseUrl() !== "http://kong:8000") return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:") return false;
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    const private172 = /^172\.(\d{1,2})\./.exec(host);
    return private172 !== null && Number(private172[1]) >= 16 && Number(private172[1]) <= 31;
  } catch {
    return false;
  }
}

function originAllowed(origin: string): boolean {
  return allowedOrigins().has(origin) || isLocalPreviewOrigin(origin);
}

export function allowedRequestOrigin(req: Request): string | null {
  const origin = req.headers.get("origin")?.trim().replace(/\/$/, "") ?? "";
  return origin && originAllowed(origin) ? origin : null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = allowedRequestOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-findit-signature, x-findit-timestamp",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
  };
}

export function json(
  req: Request,
  status: number,
  body: Record<string, unknown>,
): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

export function requestOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || allowedRequestOrigin(req) !== null;
}

export function requireJsonRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { code: "method_not_allowed", message: "POST is required." });
  }
  if (!requestOriginAllowed(req)) {
    return json(req, 403, { code: "origin_not_allowed", message: "This origin is not allowed." });
  }
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return json(req, 415, { code: "unsupported_media_type", message: "JSON is required." });
  }
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > TOUR_LIMITS.maxRequestBytes) {
    return json(req, 413, { code: "request_too_large", message: "The request is too large." });
  }
  return null;
}

export function bearerAuthorization(req: Request): string | null {
  const value = req.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function safeFilename(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255);
  return normalized || null;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

export function configuredWorkerSecret(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

export function authorizeWorker(req: Request, secretName: string): boolean {
  const secret = configuredWorkerSecret(secretName);
  if (!secret) return false;
  const supplied = req.headers.get("authorization") ?? "";
  return constantTimeEqual(supplied, `Bearer ${secret}`);
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function correlationId(): string {
  return crypto.randomUUID();
}

export type OperationalMetric = {
  name: string;
  value?: number;
  dimension?: string;
  sampleCount?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

export function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000);
}

export function shouldSample(correlation: string, denominator = 100): boolean {
  if (!Number.isInteger(denominator) || denominator < 1 || denominator > 10_000) return false;
  let hash = 2166136261;
  for (let index = 0; index < correlation.length; index += 1) {
    hash ^= correlation.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % denominator === 0;
}

export async function recordOperationalMetric(
  client: SupabaseClient,
  metric: OperationalMetric,
): Promise<void> {
  const { error } = await client.rpc("record_operational_metric", {
    p_metric_name: metric.name,
    p_value: metric.value ?? 1,
    p_dimension: metric.dimension ?? "all",
    p_sample_count: metric.sampleCount ?? 1,
    p_metadata: metric.metadata ?? {},
    p_occurred_at: metric.occurredAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error("Operational metric could not be recorded", {
      metric: metric.name,
      error: error.message,
    });
  }
}
