import { createClient } from "npm:@supabase/supabase-js@2.110.7";

interface MaintenanceRequest {
  projectionCursor?: string | null;
  projectionLimit?: number;
  retentionLimit?: number;
  includeProjection?: boolean;
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
  const value = Deno.env.get("FINDIT_RECOMMENDATION_MAINTENANCE_WORKER_SECRET");
  if (!value || value.length < 24) throw new Error("Missing recommendation maintenance secret");
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

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeCursor(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
    throw new Error("Invalid projection cursor");
  }
  return value;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
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

    const suppliedAuthorization = request.headers.get("authorization") ?? "";
    const workerSecret = configuredWorkerSecret();
    if (!constantTimeEqual(suppliedAuthorization, `Bearer ${workerSecret}`)) {
      return json(401, {
        code: "authentication_required",
        message: "A trusted scheduler credential is required.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const adminClient = createClient(supabaseUrl, configuredAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json() as MaintenanceRequest;
    const projectionLimit = boundedInteger(body.projectionLimit, 500, 1, 2000);
    const retentionLimit = boundedInteger(body.retentionLimit, 5000, 1, 50000);
    const projectionCursor = normalizeCursor(body.projectionCursor);
    const includeProjection = body.includeProjection === true;

    const now = new Date();
    const partitionMonths = Array.from({ length: 7 }, (_, offset) => {
      const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      return value.toISOString().slice(0, 10);
    });

    for (const month of partitionMonths) {
      const { error } = await adminClient.rpc("ensure_recommendation_event_partition", { p_month: month });
      if (error) throw new Error("recommendation partition operation failed");
    }

    const today = now.toISOString().slice(0, 10);
    const yesterdayDate = new Date(now.getTime() - 86_400_000);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    for (const metricDate of [yesterday, today]) {
      const { error } = await adminClient.rpc("refresh_recommendation_popularity_daily", {
        p_metric_date: metricDate,
      });
      if (error) throw new Error("recommendation popularity operation failed");
    }

    const { data: retentionData, error: retentionError } = await adminClient.rpc(
      "purge_expired_recommendation_data",
      { p_limit: retentionLimit },
    );
    if (retentionError) throw new Error("recommendation retention operation failed");

    let projectionData: unknown = null;
    if (includeProjection) {
      const { data, error } = await adminClient.rpc("refresh_listing_recommendation_features_batch", {
        p_after_listing_id: projectionCursor,
        p_limit: projectionLimit,
      });
      if (error) throw new Error("recommendation projection operation failed");
      projectionData = Array.isArray(data) ? data[0] ?? null : data;
    }

    const { data: healthData, error: healthError } = await adminClient.rpc("recommendation_foundation_health");
    if (healthError) throw new Error("recommendation health operation failed");

    const retention = Array.isArray(retentionData) ? retentionData[0] ?? {} : retentionData ?? {};
    return json(200, {
      correlationId,
      partitionsEnsured: partitionMonths.length,
      popularityDatesRefreshed: 2,
      retention: {
        eventsDeleted: Number(retention.events_deleted ?? 0),
        cacheEntriesDeleted: Number(retention.cache_entries_deleted ?? 0),
      },
      projection: projectionData,
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
