import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.7";

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
}

const SERVICE_CONFIG: Record<RecommendationServiceName, ServiceConfig> = {
  similar_listings_service: { rpc: "similar_listings_service_v1", subjectRequired: true, authenticationRequired: false },
  seller_recommendations_service: { rpc: "seller_recommendations_service_v1", subjectRequired: true, authenticationRequired: false },
  related_services_service: { rpc: "related_services_service_v1", subjectRequired: true, authenticationRequired: false },
  related_products_service: { rpc: "related_products_service_v1", subjectRequired: true, authenticationRequired: false },
  nearby_service: { rpc: "nearby_service_v1", subjectRequired: true, authenticationRequired: false },
  recently_listed_service: { rpc: "recently_listed_service_v1", subjectRequired: false, authenticationRequired: false },
  personalized_recommendation_service: { rpc: "personalized_recommendation_service_v1", subjectRequired: false, authenticationRequired: true },
};

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
  const value = Deno.env.get("SUPABASE_ANON_KEY");
  if (!value) throw new Error("Missing SUPABASE_ANON_KEY");
  return value;
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
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    } : {}),
  };
}

function json(request: Request, status: number, body: Record<string, unknown>, cacheControl?: string): Response {
  return Response.json(body, { status, headers: responseHeaders(request, cacheControl) });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const client = createClient(supabaseUrl(), publicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
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
  let timeoutHandle: number | undefined;
  const timeout = new Promise<{ data: null; error: null; timedOut: true }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ data: null, error: null, timedOut: true }), timeoutMs);
  });
  const query = client.rpc(rpc, args).then(({ data, error }) => ({ data, error, timedOut: false as const }));
  const result = await Promise.race([query, timeout]);
  if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  return result;
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
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 4096) {
      return json(request, 413, { correlationId, code: "payload_too_large", message: "The request is too large." });
    }

    let body: RecommendationRequest;
    try {
      body = await request.json() as RecommendationRequest;
    } catch {
      return json(request, 400, { correlationId, code: "invalid_json", message: "The request could not be read." });
    }

    if (config.subjectRequired && !validUuid(body.subjectListingId)) {
      return json(request, 400, { correlationId, code: "invalid_subject", message: "A valid listing is required." });
    }
    if (body.cursor !== undefined && (typeof body.cursor !== "string" || body.cursor.length > 1024)) {
      return json(request, 400, { correlationId, code: "invalid_cursor", message: "The cursor is invalid." });
    }
    const limit = boundedInteger(body.limit, 12, 1, 100);
    const distance = boundedInteger(body.maxDistanceMeters, 50_000, 100, 500_000);
    if (limit === null || (service === "nearby_service" && distance === null)) {
      return json(request, 400, { correlationId, code: "invalid_limit", message: "A request limit is outside the allowed range." });
    }
    body.limit = limit;
    if (service === "nearby_service") body.maxDistanceMeters = distance ?? 50_000;

    try {
      const viewerId = await authenticatedUserId(request);
      if (config.authenticationRequired && !viewerId) {
        return json(request, 401, { correlationId, code: "authentication_required", message: "Sign in to use personalized recommendations." });
      }

      const adminClient = createClient(supabaseUrl(), configuredAdminKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await executeWithTimeout(adminClient, config.rpc, rpcArguments(service, body, viewerId), 1200);

      if (result.timedOut) {
        return json(request, 200, {
          contractVersion: 1,
          service,
          correlationId,
          items: [],
          nextCursor: null,
          degraded: true,
          reason: "timeout",
        }, "private, max-age=0");
      }
      if (result.error) throw new Error("recommendation database operation failed");

      const payload = (result.data && typeof result.data === "object")
        ? result.data as Record<string, unknown>
        : { contractVersion: 1, service, items: [], nextCursor: null, degraded: true, reason: "invalid_response" };

      return json(request, 200, { ...payload, correlationId }, viewerId ? "private, max-age=15" : "public, max-age=15, stale-while-revalidate=60");
    } catch (error) {
      console.error("recommendation service unavailable", { correlationId, service, error });
      return json(request, 200, {
        contractVersion: 1,
        service,
        correlationId,
        items: [],
        nextCursor: null,
        degraded: true,
        reason: "service_unavailable",
      });
    }
  });
}
