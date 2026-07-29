import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

type WorkerMode = "projection" | "maintenance" | "all";

type WorkerRequest = {
  mode?: WorkerMode;
  batchSize?: number;
  maxAttempts?: number;
  retentionLimit?: number;
};

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  const resolved = value === undefined ? fallback : value;
  return Number.isInteger(resolved) && Number(resolved) >= minimum && Number(resolved) <= maximum
    ? Number(resolved)
    : null;
}

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function futurePartitionDate(monthsAhead: number): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + monthsAhead);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;

  const requestId = correlationId();
  if (!authorizeWorker(req, "FINDIT_RECOMMENDATION_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted recommendation scheduler credential is required.",
    });
  }

  let body: WorkerRequest;
  try {
    body = await req.json() as WorkerRequest;
  } catch {
    return json(req, 400, {
      requestId,
      code: "invalid_json",
      message: "The worker request could not be read.",
    });
  }

  const mode = body.mode ?? "all";
  const batchSize = boundedInteger(body.batchSize, 100, 1, 500);
  const maxAttempts = boundedInteger(body.maxAttempts, 8, 1, 20);
  const retentionLimit = boundedInteger(body.retentionLimit, 5000, 1, 50_000);

  if (!(["projection", "maintenance", "all"] as string[]).includes(mode)) {
    return json(req, 400, {
      requestId,
      code: "invalid_mode",
      message: "The requested worker mode is not supported.",
    });
  }
  if (batchSize === null || maxAttempts === null || retentionLimit === null) {
    return json(req, 400, {
      requestId,
      code: "invalid_worker_limits",
      message: "One or more worker limits are outside the allowed range.",
    });
  }

  try {
    const admin = adminClient();
    let projection = null;
    let partition = null;
    let popularityRows = null;
    let retention = null;

    if (mode === "projection" || mode === "all") {
      const { data, error } = await admin.rpc(
        "process_listing_recommendation_projection_jobs",
        { p_limit: batchSize, p_max_attempts: maxAttempts },
      );
      if (error) throw new Error(`Projection worker failed: ${error.message}`);
      projection = Array.isArray(data) ? data[0] ?? null : data;
    }

    if (mode === "maintenance" || mode === "all") {
      const { data: partitionData, error: partitionError } = await admin.rpc(
        "ensure_recommendation_event_partition",
        { p_month: futurePartitionDate(5) },
      );
      if (partitionError) throw new Error(`Partition preparation failed: ${partitionError.message}`);
      partition = partitionData;

      const { data: popularityData, error: popularityError } = await admin.rpc(
        "refresh_recommendation_popularity_daily",
        { p_metric_date: utcDateOffset(-1) },
      );
      if (popularityError) throw new Error(`Popularity refresh failed: ${popularityError.message}`);
      popularityRows = Number(popularityData ?? 0);

      const { data: retentionData, error: retentionError } = await admin.rpc(
        "purge_expired_recommendation_data",
        { p_limit: retentionLimit },
      );
      if (retentionError) throw new Error(`Recommendation retention failed: ${retentionError.message}`);
      retention = Array.isArray(retentionData) ? retentionData[0] ?? null : retentionData;
    }

    return json(req, 200, {
      requestId,
      mode,
      projection,
      preparedPartition: partition,
      popularityRows,
      retention,
    });
  } catch (error) {
    console.error("Recommendation foundation worker failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "recommendation_worker_unavailable",
      message: "Recommendation maintenance could not be completed.",
    });
  }
});
