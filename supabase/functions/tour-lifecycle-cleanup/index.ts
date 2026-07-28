import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
} from "../_shared/tour-runtime.ts";

type CleanupJob = {
  cleanup_id: string;
  lease_token: string;
  tour_id: string | null;
  intent_id: string | null;
  source_storage_path: string | null;
  playback_storage_path: string | null;
  thumbnail_storage_path: string | null;
  delete_source: boolean;
  delete_playback: boolean;
  delete_thumbnail: boolean;
  reason: string;
};

function removalSucceeded(error: { message?: string } | null): boolean {
  if (!error) return true;
  return /not.?found|does not exist|no such object/i.test(error.message ?? "");
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!authorizeWorker(req, "FINDIT_TOUR_CLEANUP_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted scheduler credential is required.",
    });
  }

  try {
    const payload = await req.json().catch(() => ({})) as { batchSize?: unknown };
    const batchSize = payload.batchSize === undefined ? 20 : Number(payload.batchSize);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
      return json(req, 400, { requestId, code: "invalid_batch_size", message: "batchSize must be from 1 to 100." });
    }

    const admin = adminClient();
    const { data, error: claimError } = await admin.rpc("claim_tour_cleanup_jobs", {
      p_batch_size: batchSize,
    });
    if (claimError) throw new Error(`Tour cleanup claim failed: ${claimError.message}`);
    const jobs = (data ?? []) as CleanupJob[];
    let cleaned = 0;
    let retryScheduled = 0;
    let finalizeFailures = 0;

    for (const job of jobs) {
      const results: boolean[] = [];
      if (job.delete_source && job.source_storage_path) {
        const { error } = await admin.storage.from("tour-sources").remove([job.source_storage_path]);
        results.push(removalSucceeded(error));
      }
      if (job.delete_playback && job.playback_storage_path) {
        const { error } = await admin.storage.from("tour-playback").remove([job.playback_storage_path]);
        results.push(removalSucceeded(error));
      }
      if (job.delete_thumbnail && job.thumbnail_storage_path) {
        const { error } = await admin.storage.from("tour-thumbnails").remove([job.thumbnail_storage_path]);
        results.push(removalSucceeded(error));
      }
      const succeeded = results.every(Boolean);
      const { data: finalized, error: finalizeError } = await admin.rpc("finalize_tour_cleanup_job", {
        p_cleanup_id: job.cleanup_id,
        p_lease_token: job.lease_token,
        p_succeeded: succeeded,
        p_error_code: succeeded ? null : "storage_remove_failed",
      });
      if (finalizeError || finalized !== true) {
        finalizeFailures += 1;
        console.error("Tour cleanup finalization failed", {
          requestId,
          cleanupId: job.cleanup_id,
          tourId: job.tour_id,
          error: finalizeError?.message,
        });
      } else if (succeeded) {
        cleaned += 1;
      } else {
        retryScheduled += 1;
      }
    }

    return json(req, finalizeFailures > 0 ? 207 : 200, {
      requestId,
      claimed: jobs.length,
      cleaned,
      retryScheduled,
      finalizeFailures,
    });
  } catch (error) {
    console.error("Tour lifecycle cleanup failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "cleanup_unavailable",
      message: "Tour cleanup is temporarily unavailable.",
    });
  }
});
