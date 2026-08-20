import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function boundedLimit(value: unknown): number | null {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= MAX_LIMIT ? value : null;
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;

  const requestId = correlationId();
  if (!authorizeWorker(req, "FINDIT_PLATFORM_MAINTENANCE_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted scheduler credential is required.",
    });
  }

  try {
    const payload = await req.json().catch(() => ({})) as { limit?: unknown };
    const limit = boundedLimit(payload.limit);
    if (limit === null) {
      return json(req, 400, {
        requestId,
        code: "invalid_limit",
        message: `limit must be an integer from 1 to ${MAX_LIMIT}.`,
      });
    }

    const admin = adminClient();
    const operations = [
      ["expire_stale_peek_request_fulfilments", { p_limit: limit }],
      ["prune_abuse_rate_limit_buckets", { p_limit: limit }],
      ["purge_recommendation_request_budget_v1", { p_maximum_rows: limit }],
      ["retry_recommendation_projection_dead_letters", { p_limit: limit }],
      ["recommendation_analytics_health_v1", {}],
    ] as const;
    const results: Record<string, unknown> = {};

    for (const [name, args] of operations) {
      const { data, error } = await admin.rpc(name, args);
      if (error) throw new Error(`${name} failed`);
      results[name] = Array.isArray(data) ? data[0] ?? null : data;
    }

    return json(req, 200, { requestId, limit, results });
  } catch (error) {
    console.error("platform maintenance failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "platform_maintenance_unavailable",
      message: "Platform maintenance is temporarily unavailable.",
    });
  }
});
