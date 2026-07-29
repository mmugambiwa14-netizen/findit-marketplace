import { createClient } from "npm:@supabase/supabase-js@2.110.7";

// Operational health for the Phase 3 contextual layer. Follows the same trusted
// monitoring-credential boundary as recommendation-service-health: this is an
// internal endpoint, never a browser API, and it returns counts only.

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
  const value = Deno.env.get("FINDIT_CONTEXTUAL_HEALTH_SECRET");
  if (!value || value.length < 24) throw new Error("Missing contextual health secret");
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

    const { data, error } = await client.rpc("contextual_ecosystem_health_v1");
    if (error || !data || typeof data !== "object") {
      throw new Error("contextual health operation failed");
    }

    const health = data as Record<string, unknown>;
    const activeRules = Number(health.activeRules ?? 0);
    const rulesReferencingDisabledServices = Number(health.rulesReferencingDisabledServices ?? 0);

    return json(200, {
      correlationId,
      status: "ok",
      contractVersion: 1,
      activeContexts: Number(health.activeContexts ?? 0),
      activeRules,
      rulesReferencingDisabledServices,
      // Every active rule pointing at a disabled service means the orchestrator can
      // select nothing, which is a configuration signal rather than a fault.
      orchestrationSelectable: activeRules > rulesReferencingDisabledServices,
      health,
    });
  } catch (error) {
    console.error("contextual ecosystem health unavailable", { correlationId, error });
    return json(503, {
      correlationId,
      status: "unavailable",
      code: "contextual_health_unavailable",
      message: "Contextual ecosystem health is temporarily unavailable.",
    });
  }
});
