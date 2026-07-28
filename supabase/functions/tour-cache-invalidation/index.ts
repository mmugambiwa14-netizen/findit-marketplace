import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

type Invalidation = {
  invalidation_id: number;
  claim_token: string;
  tour_id: string | null;
  parent_type: "listing" | "service";
  parent_id: string;
  reason: string;
};

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!authorizeWorker(req, "FINDIT_TOUR_CACHE_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted scheduler credential is required.",
    });
  }

  try {
    const payload = await req.json().catch(() => ({})) as { batchSize?: unknown };
    const batchSize = payload.batchSize === undefined ? 100 : Number(payload.batchSize);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
      return json(req, 400, { requestId, code: "invalid_batch_size", message: "batchSize must be from 1 to 500." });
    }

    const admin = adminClient();
    const { data, error: claimError } = await admin.rpc("claim_tour_cache_invalidations", {
      p_batch_size: batchSize,
    });
    if (claimError) throw new Error(`Tour cache claim failed: ${claimError.message}`);
    const entries = (data ?? []) as Invalidation[];

    let purgeSucceeded = true;
    const endpoint = Deno.env.get("TOUR_CACHE_PURGE_URL");
    if (entries.length > 0 && endpoint) {
      const secret = Deno.env.get("TOUR_CACHE_PURGE_SECRET");
      if (!secret) throw new Error("Missing TOUR_CACHE_PURGE_SECRET");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "authorization": `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ invalidations: entries.map((entry) => ({
          tourId: entry.tour_id,
          parentType: entry.parent_type,
          parentId: entry.parent_id,
          reason: entry.reason,
        })) }),
        signal: AbortSignal.timeout(10_000),
      });
      purgeSucceeded = response.ok;
    }

    let finalized = 0;
    let retryScheduled = 0;
    for (const entry of entries) {
      const { data: result, error } = await admin.rpc("finalize_tour_cache_invalidation", {
        p_invalidation_id: entry.invalidation_id,
        p_claim_token: entry.claim_token,
        p_succeeded: purgeSucceeded,
        p_error_code: purgeSucceeded ? null : "cache_purge_failed",
      });
      if (!error && result === true) {
        if (purgeSucceeded) finalized += 1;
        else retryScheduled += 1;
      }
    }

    return json(req, purgeSucceeded ? 200 : 207, {
      requestId,
      claimed: entries.length,
      finalized,
      retryScheduled,
      externalPurgeConfigured: Boolean(endpoint),
    });
  } catch (error) {
    console.error("Tour cache invalidation failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "cache_invalidation_unavailable",
      message: "Tour cache invalidation is temporarily unavailable.",
    });
  }
});
