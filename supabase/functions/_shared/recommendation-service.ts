import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.7";
import { configuredPublishableKey } from "./tour-runtime.ts";
import { BODY_INVALID, BODY_TOO_LARGE, readBoundedJson } from "./request-guards.ts";

const MAXIMUM_REQUEST_BYTES = 4096;
const IDENTITY_TIMEOUT_MS = 1000;

export type RecommendationServiceName =
  | "similar_listings_service"
  | "seller_recommendations_service"
  | "related_services_service"
  | "related_products_service"
  | "nearby_service"
  | "recently_listed_service"
  | "personalized_recommendation_service";

interface RecommendationRequest {
  subjectListingId?: string;
  cursor?: string;
  limit?: number;
  maxDistanceMeters?: number;
}

interface ServiceConfig {
  rpc: string;
  subjectRequired: boolean;
  authenticationRequired: boolean;
  sharedCacheAllowed: boolean;
}

interface RuntimePolicy {
  serviceName: RecommendationServiceName;
  contractVersion: number;
  enabled: boolean;
  timeoutMs: number;
  cacheFreshSeconds: number;
  cacheStaleSeconds: number;
  maximumPageSize: number;
  circuitOpen: boolean;
  requestBudgetPerWindow: number;
  requestBudgetWindowSeconds: number;
}

interface CachedRecommendation {
  payload: Record<string, unknown>;
  generatedAt: number;
  staleAt: number;
  expiresAt: number;
}

interface CircuitState {
  consecutiveFailures: number;
  openUntil: number;
}

const SERVICE_CONFIG: Record<RecommendationServiceName, ServiceConfig> = {
  similar_listings_service: { rpc: "similar_listings_service_v1", subjectRequired: true, authenticationRequired: false, sharedCacheAllowed: true },
  seller_recommendations_service: { rpc: "seller_recommendations_service_v1", subjectRequired: true, authenticationRequired: false, sharedCacheAllowed: true },
  related_services_service: { rpc: "related_services_service_v1", subjectRequired: true, authenticationRequired: false, sharedCacheAllowed: true },
  related_products_service: { rpc: "related_products_service_v1", subjectRequired: true, authenticationRequired: false, sharedCacheAllowed: true },
  nearby_service: { rpc: "nearby_service_v1", subjectRequired: true, authenticationRequired: false, sharedCacheAllowed: true },
  recently_listed_service: { rpc: "recently_listed_service_v1", subjectRequired: false, authenticationRequired: false, sharedCacheAllowed: true },
  personalized_recommendation_service: { rpc: "personalized_recommendation_service_v1", subjectRequired: false, authenticationRequired: true, sharedCacheAllowed: false },
};

const circuitStates = new Map<RecommendationServiceName, CircuitState>();
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;

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

function supabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("Missing SUPABASE_URL");
  return value;
}

function publicKey(): string {
  return configuredPublishableKey();
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const configured = (Deno.env.get("FINDIT_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.includes(origin)) return origin;
  if (Deno.env.get("DENO_ENV") !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return null;
}

function responseHeaders(request: Request, cacheControl = "no-store"): HeadersInit {
  const origin = allowedOrigin(request);
  return {
    "Content-Type": "application/json",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin, Authorization",
    ...(origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    } : {}),
  };
}

function json(request: Request, status: number, body: Record<string, unknown>, cacheControl?: string): Response {
  return Response.json(body, { status, headers: responseHeaders(request, cacheControl) });
}

// A signed-in viewer's response must never be retained by a shared cache, whether it
// was produced by a cache hit or a fresh execution.
function viewerCacheControl(viewerId: string | null): string {
  return viewerId ? "private, max-age=0" : "public, max-age=15, stale-while-revalidate=60";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// A closed set of page sizes keeps the shared cache key space small and bounded.
// Rounding up never returns fewer items than were asked for.
const LIMIT_BUCKETS = [6, 12, 24, 48, 100] as const;

function bucketedLimit(limit: number): number {
  return LIMIT_BUCKETS.find((bucket) => limit <= bucket) ?? LIMIT_BUCKETS[LIMIT_BUCKETS.length - 1];
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number | null {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isInteger(resolved)) return null;
  if (resolved < minimum || resolved > maximum) return null;
  return resolved;
}

async function authenticatedUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IDENTITY_TIMEOUT_MS);
  const client = createClient(supabaseUrl(), publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: authorization },
      fetch: (input, init = {}) => fetch(input, { ...init, signal: controller.signal }),
    },
  });

  try {
    const { data, error } = await client.auth.getUser();
    return error || !data.user ? null : data.user.id;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function rpcArguments(
  service: RecommendationServiceName,
  body: RecommendationRequest,
  viewerId: string | null,
): Record<string, unknown> {
  const common = { p_cursor: body.cursor ?? null, p_limit: body.limit ?? 12 };
  switch (service) {
    case "recently_listed_service":
      return common;
    case "personalized_recommendation_service":
      return { p_viewer_id: viewerId, ...common };
    case "nearby_service":
      return {
        p_subject_listing_id: body.subjectListingId,
        ...common,
        p_max_distance_meters: body.maxDistanceMeters ?? 50_000,
      };
    default:
      return { p_subject_listing_id: body.subjectListingId, ...common };
  }
}

async function executeWithTimeout(
  client: SupabaseClient,
  rpc: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ data: unknown; error: unknown; timedOut: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await client.rpc(rpc, args).abortSignal(controller.signal);
    return { data, error, timedOut: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { data: null, error: null, timedOut: true };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runtimePolicy(client: SupabaseClient, service: RecommendationServiceName): Promise<RuntimePolicy> {
  // Policy and durable circuit state arrive together, so enforcing the breaker
  // across isolates costs no additional round trip.
  const { data, error } = await client.rpc("recommendation_service_runtime_state_v1", { p_service_name: service });
  if (error || !data || typeof data !== "object") throw new Error("recommendation policy unavailable");

  const value = data as Record<string, unknown>;
  const policy: RuntimePolicy = {
    serviceName: value.serviceName as RecommendationServiceName,
    contractVersion: Number(value.contractVersion),
    enabled: value.enabled === true,
    timeoutMs: Number(value.timeoutMs),
    cacheFreshSeconds: Number(value.cacheFreshSeconds),
    cacheStaleSeconds: Number(value.cacheStaleSeconds),
    maximumPageSize: Number(value.maximumPageSize),
    circuitOpen: value.circuitOpen === true,
    requestBudgetPerWindow: Number(value.requestBudgetPerWindow),
    requestBudgetWindowSeconds: Number(value.requestBudgetWindowSeconds),
  };

  if (
    policy.serviceName !== service ||
    !Number.isInteger(policy.contractVersion) || policy.contractVersion < 1 ||
    !Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 50 || policy.timeoutMs > 5000 ||
    !Number.isInteger(policy.cacheFreshSeconds) || policy.cacheFreshSeconds < 0 ||
    !Number.isInteger(policy.cacheStaleSeconds) || policy.cacheStaleSeconds < 1 ||
    !Number.isInteger(policy.maximumPageSize) || policy.maximumPageSize < 1 || policy.maximumPageSize > 100 ||
    !Number.isInteger(policy.requestBudgetPerWindow) || policy.requestBudgetPerWindow < 1 ||
    !Number.isInteger(policy.requestBudgetWindowSeconds) || policy.requestBudgetWindowSeconds < 1
  ) {
    throw new Error("invalid recommendation policy");
  }

  return policy;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function cacheKey(service: RecommendationServiceName, body: RecommendationRequest): Promise<string> {
  return sha256(JSON.stringify({
    version: 1,
    service,
    subjectListingId: body.subjectListingId ?? null,
    cursor: body.cursor ?? null,
    limit: body.limit ?? 12,
    maxDistanceMeters: service === "nearby_service" ? body.maxDistanceMeters ?? 50_000 : null,
  }));
}

async function readCache(
  client: SupabaseClient,
  service: RecommendationServiceName,
  key: string,
): Promise<CachedRecommendation | null> {
  const { data, error } = await client
    .from("recommendation_cache")
    .select("payload,generated_at,stale_at,expires_at")
    .eq("cache_key", key)
    .eq("service_name", service)
    .maybeSingle();

  if (error || !data || typeof data.payload !== "object" || data.payload === null) return null;
  const generatedAt = Date.parse(data.generated_at);
  const staleAt = Date.parse(data.stale_at);
  const expiresAt = Date.parse(data.expires_at);
  if (![generatedAt, staleAt, expiresAt].every(Number.isFinite)) return null;
  return { payload: data.payload as Record<string, unknown>, generatedAt, staleAt, expiresAt };
}

async function writeCache(
  client: SupabaseClient,
  service: RecommendationServiceName,
  key: string,
  subjectListingId: string | undefined,
  payload: Record<string, unknown>,
  policy: RuntimePolicy,
): Promise<void> {
  const generatedAt = new Date();
  const staleAt = new Date(generatedAt.getTime() + policy.cacheFreshSeconds * 1000);
  const expiresAt = new Date(generatedAt.getTime() + policy.cacheStaleSeconds * 1000);
  await client.from("recommendation_cache").upsert({
    cache_key: key,
    service_name: service,
    contract_version: policy.contractVersion,
    subject_listing_id: subjectListingId ?? null,
    viewer_scope_hash: null,
    payload,
    generated_at: generatedAt.toISOString(),
    stale_at: staleAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }, { onConflict: "cache_key" });
}

function validPayload(payload: unknown, service: RecommendationServiceName, contractVersion: number): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return value.service === service &&
    Number(value.contractVersion) === contractVersion &&
    Array.isArray(value.items) &&
    (value.nextCursor === null || typeof value.nextCursor === "string") &&
    typeof value.degraded === "boolean";
}

// The in-isolate map stays as a fast local short-circuit for a warm isolate. The
// durable state carried on the policy read is what makes the breaker meaningful
// across the many isolates an Edge Function actually runs in.
function circuitOpen(service: RecommendationServiceName, policy: RuntimePolicy | null): boolean {
  if (policy?.circuitOpen) return true;
  const state = circuitStates.get(service);
  return Boolean(state && state.openUntil > Date.now());
}

async function recordSuccess(service: RecommendationServiceName, client?: SupabaseClient): Promise<void> {
  circuitStates.set(service, { consecutiveFailures: 0, openUntil: 0 });
  await persistOutcome(service, true, client);
}

async function recordFailure(service: RecommendationServiceName, client?: SupabaseClient): Promise<void> {
  const current = circuitStates.get(service) ?? { consecutiveFailures: 0, openUntil: 0 };
  const failures = current.consecutiveFailures + 1;
  circuitStates.set(service, {
    consecutiveFailures: failures,
    openUntil: failures >= FAILURE_THRESHOLD ? Date.now() + CIRCUIT_OPEN_MS : 0,
  });
  await persistOutcome(service, false, client);
}

type EdgeRuntimeLike = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

function edgeRuntime(): EdgeRuntimeLike | null {
  return (globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime ?? null;
}

async function persistOutcome(service: RecommendationServiceName, succeeded: boolean, client?: SupabaseClient): Promise<void> {
  if (!client) return;
  const persistence = client
    .rpc("record_recommendation_service_outcome_v1", {
      p_service_name: service,
      p_succeeded: succeeded,
      p_failure_threshold: FAILURE_THRESHOLD,
      p_open_seconds: Math.round(CIRCUIT_OPEN_MS / 1000),
    })
    .then(() => undefined, () => undefined);

  const runtime = edgeRuntime();
  if (runtime?.waitUntil) {
    runtime.waitUntil(Promise.resolve(persistence));
    return;
  }
  await persistence;
}

/**
 * Opaque, salted digest of the caller. No address is stored or logged; only this
 * digest reaches the database, and it rotates whenever the salt is rotated.
 */
async function clientHash(request: Request): Promise<string | null> {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  if (!forwarded) return null;
  const salt = Deno.env.get("FINDIT_REQUEST_BUDGET_SALT") ?? "";
  if (!salt) return null;
  return await sha256(`${salt}:${forwarded}`);
}

function degradedPayload(
  service: RecommendationServiceName,
  contractVersion: number,
  correlationId: string,
  reason: string,
  cached?: CachedRecommendation | null,
): Record<string, unknown> {
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.payload,
      correlationId,
      degraded: true,
      stale: true,
      reason,
    };
  }
  return {
    contractVersion,
    service,
    correlationId,
    items: [],
    nextCursor: null,
    degraded: true,
    reason,
  };
}

export function serveRecommendationService(service: RecommendationServiceName): void {
  const config = SERVICE_CONFIG[service];

  Deno.serve(async (request: Request) => {
    const correlationId = crypto.randomUUID();

    if (request.method === "OPTIONS") {
      if (!allowedOrigin(request)) return new Response(null, { status: 403, headers: responseHeaders(request) });
      return new Response(null, { status: 204, headers: responseHeaders(request) });
    }
    if (request.method !== "POST") {
      return json(request, 405, { correlationId, code: "method_not_allowed", message: "POST is required." });
    }
    if (request.headers.get("origin") && !allowedOrigin(request)) {
      return json(request, 403, { correlationId, code: "origin_not_allowed", message: "This origin is not allowed." });
    }

    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return json(request, 415, { correlationId, code: "unsupported_media_type", message: "A JSON request is required." });
    }
    // Bound what is actually buffered. A chunked request carries no content-length,
    // so a header-only check can be bypassed entirely.
    const parsed = await readBoundedJson(request, MAXIMUM_REQUEST_BYTES);
    if (parsed === BODY_TOO_LARGE) {
      return json(request, 413, { correlationId, code: "payload_too_large", message: "The request is too large." });
    }
    if (parsed === BODY_INVALID || !parsed || typeof parsed !== "object") {
      return json(request, 400, { correlationId, code: "invalid_json", message: "The request could not be read." });
    }
    const body = parsed as RecommendationRequest;

    if (config.subjectRequired && !validUuid(body.subjectListingId)) {
      return json(request, 400, { correlationId, code: "invalid_subject", message: "A valid listing is required." });
    }
    // A null cursor is the explicit "first page" signal the browser adapter sends;
    // only a present, non-null cursor is subject to the string and length bounds.
    if (body.cursor !== undefined && body.cursor !== null
      && (typeof body.cursor !== "string" || body.cursor.length === 0 || body.cursor.length > 1024)) {
      return json(request, 400, { correlationId, code: "invalid_cursor", message: "The cursor is invalid." });
    }
    const requestedLimit = boundedInteger(body.limit, 12, 1, 100);
    const distance = boundedInteger(body.maxDistanceMeters, 50_000, 100, 500_000);
    if (requestedLimit === null || (service === "nearby_service" && distance === null)) {
      return json(request, 400, { correlationId, code: "invalid_limit", message: "A request limit is outside the allowed range." });
    }
    if (service === "nearby_service") body.maxDistanceMeters = distance ?? 50_000;

    let cached: CachedRecommendation | null = null;
    let policy: RuntimePolicy | null = null;

    try {
      const viewerId = await authenticatedUserId(request);
      if (config.authenticationRequired && !viewerId) {
        return json(request, 401, { correlationId, code: "authentication_required", message: "Sign in to use personalized recommendations." });
      }

      const adminClient = createClient(supabaseUrl(), configuredAdminKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      policy = await runtimePolicy(adminClient, service);
      // Bucket the page size before it reaches the cache key, so a caller cannot
      // mint unbounded distinct cache entries by varying the limit by one.
      body.limit = bucketedLimit(Math.min(requestedLimit, policy.maximumPageSize));

      if (!policy.enabled) {
        return json(request, 200, degradedPayload(service, policy.contractVersion, correlationId, "service_disabled"));
      }

      const key = config.sharedCacheAllowed ? await cacheKey(service, body) : null;
      if (key) {
        cached = await readCache(adminClient, service, key);
        if (cached && cached.staleAt > Date.now()) {
          return json(request, 200, { ...cached.payload, correlationId, cache: "fresh" }, viewerCacheControl(viewerId));
        }
      }

      if (circuitOpen(service, policy)) {
        return json(request, 200, degradedPayload(service, policy.contractVersion, correlationId, "circuit_open", cached));
      }

      // Budget is consumed only once a request is about to reach the database, so
      // cache hits and disabled services do not spend it.
      const hash = await clientHash(request);
      if (hash) {
        const { data: withinBudget } = await adminClient.rpc("consume_recommendation_request_budget_v1", {
          p_client_hash: hash,
          p_service_name: service,
          p_budget: policy.requestBudgetPerWindow,
          p_window_seconds: policy.requestBudgetWindowSeconds,
        });
        if (withinBudget === false) {
          return json(request, 200, degradedPayload(service, policy.contractVersion, correlationId, "request_budget_exhausted", cached), "private, max-age=0");
        }
      }

      const result = await executeWithTimeout(adminClient, config.rpc, rpcArguments(service, body, viewerId), policy.timeoutMs);
      if (result.timedOut) {
        await recordFailure(service, adminClient);
        return json(request, 200, degradedPayload(service, policy.contractVersion, correlationId, "timeout", cached), "private, max-age=0");
      }
      if (result.error || !validPayload(result.data, service, policy.contractVersion)) {
        await recordFailure(service, adminClient);
        return json(request, 200, degradedPayload(service, policy.contractVersion, correlationId, "invalid_or_unavailable_response", cached));
      }

      await recordSuccess(service, adminClient);
      const payload = result.data;
      if (key && payload.degraded === false) {
        try {
          await writeCache(adminClient, service, key, body.subjectListingId, payload, policy);
        } catch (error) {
          console.error("recommendation cache write failed", { correlationId, service, error });
        }
      }

      return json(
        request,
        200,
        { ...payload, correlationId, cache: "miss" },
        viewerCacheControl(viewerId),
      );
    } catch (error) {
      await recordFailure(service);
      console.error("recommendation service unavailable", { correlationId, service, error });
      return json(request, 200, degradedPayload(service, policy?.contractVersion ?? 1, correlationId, "service_unavailable", cached));
    }
  });
}
