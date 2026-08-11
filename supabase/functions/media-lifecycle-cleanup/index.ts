import { createClient } from "npm:@supabase/supabase-js@2.110.7";

type CleanupCandidate = {
  intent_kind: "listing" | "marketplace";
  intent_id: string;
  bucket_id: "listing-images" | "marketplace-images";
  storage_path: string;
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
  throw new Error("Missing SUPABASE_SECRET_KEY");
}

function configuredWorkerSecret(): string {
  const secret = Deno.env.get("FINDIT_MEDIA_CLEANUP_WORKER_SECRET")?.trim();
  if (!secret) throw new Error("Missing FINDIT_MEDIA_CLEANUP_WORKER_SECRET");
  return secret;
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
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { code: "method_not_allowed", message: "POST is required." });
  }

  const correlationId = crypto.randomUUID();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    const adminKey = configuredAdminKey();
    const workerSecret = configuredWorkerSecret();
    const suppliedAuthorization = req.headers.get("authorization") ?? "";
    if (!constantTimeEqual(suppliedAuthorization, `Bearer ${workerSecret}`)) {
      return json(401, { code: "authentication_required", message: "A trusted scheduler credential is required." });
    }

    let requestedBatchSize = 50;
    try {
      const payload = await req.json() as { batchSize?: unknown };
      if (payload.batchSize !== undefined) requestedBatchSize = Number(payload.batchSize);
    } catch {
      // An empty body uses the bounded default.
    }
    if (!Number.isInteger(requestedBatchSize) || requestedBatchSize < 1 || requestedBatchSize > 100) {
      return json(400, { code: "invalid_batch_size", message: "batchSize must be an integer from 1 to 100." });
    }

    const adminClient = createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error: claimError } = await adminClient.rpc("claim_expired_image_uploads", {
      p_batch_size: requestedBatchSize,
    });
    if (claimError) throw new Error("cleanup claim failed");
    const candidates = (data ?? []) as CleanupCandidate[];
    let cleaned = 0;
    let retryScheduled = 0;
    let finalizeFailures = 0;

    for (const candidate of candidates) {
      const { error: removeError } = await adminClient.storage
        .from(candidate.bucket_id)
        .remove([candidate.storage_path]);
      const succeeded = !removeError;
      const { data: finalized, error: finalizeError } = await adminClient.rpc(
        "finalize_image_upload_cleanup",
        {
          p_intent_kind: candidate.intent_kind,
          p_intent_id: candidate.intent_id,
          p_succeeded: succeeded,
          p_error_code: succeeded ? null : "storage_remove_failed",
        },
      );
      if (finalizeError || finalized !== true) {
        finalizeFailures += 1;
        console.error("media cleanup finalization failed", {
          correlationId,
          intentKind: candidate.intent_kind,
          intentId: candidate.intent_id,
        });
      } else if (succeeded) {
        cleaned += 1;
      } else {
        retryScheduled += 1;
      }
    }

    return json(finalizeFailures > 0 ? 207 : 200, {
      correlationId,
      claimed: candidates.length,
      cleaned,
      retryScheduled,
      finalizeFailures,
    });
  } catch (error) {
    console.error("media lifecycle cleanup failed", { correlationId, error });
    return json(500, {
      correlationId,
      code: "cleanup_unavailable",
      message: "Media cleanup is temporarily unavailable.",
    });
  }
});
