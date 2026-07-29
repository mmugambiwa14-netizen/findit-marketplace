import { createClient } from "npm:@supabase/supabase-js@2.110.7";

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

function configuredHealthSecret(): string {
  const value = Deno.env.get("FINDIT_RECOMMENDATION_HEALTH_SECRET");
  if (!value || value.length < 24) throw new Error("Missing recommendation health secret");
  return value;
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

Deno.serve(async (request: Request) => {
  const correlationId = crypto.randomUUID();

  if (request.method !== "GET" && request.method !== "POST") {
    return json(405, { correlationId, code: "method_not_allowed", message: "GET or POST is required." });
  }

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${configuredHealthSecret()}`;
    if (!constantTimeEqual(authorization, expected)) {
      return json(401, {
        correlationId,
        code: "authentication_required",
        message: "A trusted monitoring credential is required.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");

    const client = createClient(supabaseUrl, configuredAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.rpc("recommendation_services_health_v1");
    if (error || !data || typeof data !== "object") {
      throw new Error("recommendation health operation failed");
    }

    const services = Array.isArray((data as Record<string, unknown>).services)
      ? (data as Record<string, unknown>).services as Array<Record<string, unknown>>
      : [];
    const enabledServices = services.filter((service) => service.enabled === true).length;
    const expiredCacheEntries = services.reduce(
      (total, service) => total + Number(service.expiredCacheEntries ?? 0),
      0,
    );

    return json(200, {
      correlationId,
      status: "ok",
      contractVersion: 1,
      serviceCount: services.length,
      enabledServices,
      expiredCacheEntries,
      health: data,
    });
  } catch (error) {
    console.error("recommendation service health unavailable", { correlationId, error });
    return json(503, {
      correlationId,
      status: "unavailable",
      code: "recommendation_health_unavailable",
      message: "Recommendation service health is temporarily unavailable.",
    });
  }
});
