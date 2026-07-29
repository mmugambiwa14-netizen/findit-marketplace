import { createClient } from "npm:@supabase/supabase-js@2.110.7";

type MaintenanceMode = "projection" | "maintenance" | "all";

interface MaintenanceRequest {
  mode?: MaintenanceMode;
  projectionLimit?: number;
  projectionMaxAttempts?: number;
  retentionLimit?: number;
}

function configuredAdminKey(): string {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;

  const serialized = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (serialized) {
    const values = JSON.parse(serialized) as Record<string, string>;
    const value = values.default ?? Object.values(values)[0];
    if (value) return value;
  }

  throw new Error("Missing SUPABASE_SECRET_KEY");
}

function configuredWorkerSecret(): string {
  const value = Deno.env.get("FINDIT_RECOMMENDATION_WORKER_SECRET");
  if (!value || value.length < 24) throw new Error("Missing recommendation worker secret");
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

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isInteger(resolved)) return null;
  if (resolved < minimum || resolved > maximum) return null;
  return resolved;
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
  if (request.method !== "POST") {
    return json(405, { code: "method_not_allowed", message: "POST is required." });
  }

  const correlationId = crypto.randomUUID();
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return json(415, { code: "unsupported_media_type", message: "A JSON request is required." });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 4096) {
      return json(413, { code: "payload_too_large", message: "The maintenance request is too large." });
    }

    const suppliedAuthorization = request.headers.get("authorization") ?? "";
    const workerSecret = configuredWorkerSecret();
    if (!constantTimeEqual(suppliedAuthorization, `Bearer ${workerSecret}`)) {
      return json(401, {
        code: "authentication_required",
        message: "A trusted scheduler credential is required.",
      });
    }

    let body: MaintenanceRequest;
    try {
      body = await request.json() as MaintenanceRequest;
    } catch {
      return json(400, { code: "invalid_json", message: "The maintenance request could not be read." });
    }

    const mode = body.mode ?? "all";
    const projectionLimit = boundedInteger(body.projectionLimit, 200, 1, 500);
    const projectionMaxAttempts = boundedInteger(body.projectionMaxAttempts, 8, 1, 20);
    const retentionLimit = boundedInteger(body.retentionLimit, 5000, 1, 50_000);

    if (!(mode === "projection" || mode === "maintenance" || mode === "all")) {
      return json(400, { code: "invalid_mode", message: "The requested maintenance mode is not supported." });
    }
    if (projectionLimit === null || projectionMaxAttempts === null || retentionLimit === null) {
      return json(400, {
        code: "invalid_limits",
        message: "One or more maintenance limits are outside the allowed range.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const adminClient = createClient(supabaseUrl, configuredAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let projection: unknown = null;
    let partitionsEnsured = 0;
    let popularityDatesRefreshed = 0;
    let retention: Record<string, unknown> = {};

    if (mode === "projection" || mode === "all") {
      const { data, error } = await adminClient.rpc("process_listing_recommendation_projection_jobs", {
        p_limit: projectionLimit,
        p_max_attempts: projectionMaxAttempts,
      });
      if (error) throw new Error("recommendation projection queue operation failed");
      projection = Array.isArray(data) ? data[0] ?? null : data;
    }

    if (mode === "maintenance" || mode === "all") {
      const now = new Date();
      const partitionMonths = Array.from({ length: 7 }, (_, offset) => {
        const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
        return value.toISOString().slice(0, 10);
      });

      for (const month of partitionMonths) {
        const { error } = await adminClient.rpc("ensure_recommendation_event_partition", { p_month: month });
        if (error) throw new Error("recommendation partition operation failed");
      }
      partitionsEnsured = partitionMonths.length;

      const today = now.toISOString().slice(0, 10);
      const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
      for (const metricDate of [yesterday, today]) {
        const { error } = await adminClient.rpc("refresh_recommendation_popularity_daily", {
          p_metric_date: metricDate,
        });
        if (error) throw new Error("recommendation popularity operation failed");
      }
      popularityDatesRefreshed = 2;

      const { data: retentionData, error: retentionError } = await adminClient.rpc(
        "purge_expired_recommendation_data",
        { p_limit: retentionLimit },
      );
      if (retentionError) throw new Error("recommendation retention operation failed");
      retention = Array.isArray(retentionData) ? retentionData[0] ?? {} : retentionData ?? {};
    }

    const { data: healthData, error: healthError } = await adminClient.rpc("recommendation_foundation_health");
    if (healthError) throw new Error("recommendation health operation failed");

    return json(200, {
      correlationId,
      mode,
      projection,
      partitionsEnsured,
      popularityDatesRefreshed,
      retention: {
        eventsDeleted: Number(retention.events_deleted ?? 0),
        cacheEntriesDeleted: Number(retention.cache_entries_deleted ?? 0),
      },
      health: healthData,
    });
  } catch (error) {
    console.error("recommendation maintenance failed", { correlationId, error });
    return json(500, {
      correlationId,
      code: "recommendation_maintenance_unavailable",
      message: "Recommendation maintenance is temporarily unavailable.",
    });
  }
});
