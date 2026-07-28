import {
  adminClient,
  authorizeWorker,
  correlationId,
  json,
  requireJsonRequest,
  toursBackendEnabled,
} from "../_shared/tour-runtime.ts";
import { dispatchTourProcessing } from "../_shared/tour-provider.ts";

type ProcessingCandidate = {
  tour_id: string;
  lease_token: string;
  source_bucket: string;
  source_storage_path: string;
  playback_bucket: string;
  playback_storage_path: string;
  thumbnail_bucket: string;
  thumbnail_storage_path: string;
  declared_mime_type: string;
  declared_byte_size: number;
  declared_duration_seconds: number;
  processing_attempt: number;
};

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!authorizeWorker(req, "FINDIT_TOUR_PROCESSING_WORKER_SECRET")) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "A trusted scheduler credential is required.",
    });
  }
  if (!toursBackendEnabled()) {
    return json(req, 200, { requestId, claimed: 0, dispatched: 0, failed: 0, disabled: true });
  }

  try {
    const payload = await req.json().catch(() => ({})) as { batchSize?: unknown };
    const batchSize = payload.batchSize === undefined ? 5 : Number(payload.batchSize);
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
      return json(req, 400, { requestId, code: "invalid_batch_size", message: "batchSize must be from 1 to 20." });
    }

    const callbackUrl = Deno.env.get("TOUR_PROCESSING_CALLBACK_URL");
    if (!callbackUrl) throw new Error("Missing TOUR_PROCESSING_CALLBACK_URL");
    const admin = adminClient();
    const { data, error: claimError } = await admin.rpc("claim_tour_processing_jobs", {
      p_batch_size: batchSize,
    });
    if (claimError) throw new Error(`Tour processing claim failed: ${claimError.message}`);

    const candidates = (data ?? []) as ProcessingCandidate[];
    let dispatched = 0;
    let failed = 0;
    const failures: Array<{ tourId: string; code: string }> = [];

    for (const candidate of candidates) {
      try {
        const [source, playback, thumbnail] = await Promise.all([
          admin.storage.from(candidate.source_bucket).createSignedUrl(candidate.source_storage_path, 3600),
          admin.storage.from(candidate.playback_bucket).createSignedUploadUrl(candidate.playback_storage_path, { upsert: true }),
          admin.storage.from(candidate.thumbnail_bucket).createSignedUploadUrl(candidate.thumbnail_storage_path, { upsert: true }),
        ]);
        if (source.error || !source.data?.signedUrl) throw new Error("source_signing_failed");
        if (playback.error || !playback.data?.signedUrl) throw new Error("playback_signing_failed");
        if (thumbnail.error || !thumbnail.data?.signedUrl) throw new Error("thumbnail_signing_failed");

        const result = await dispatchTourProcessing({
          tourId: candidate.tour_id,
          leaseToken: candidate.lease_token,
          attempt: candidate.processing_attempt,
          source: {
            signedUrl: source.data.signedUrl,
            mimeType: candidate.declared_mime_type,
            byteSize: Number(candidate.declared_byte_size),
            declaredDurationSeconds: Number(candidate.declared_duration_seconds),
          },
          playback: {
            signedUploadUrl: playback.data.signedUrl,
            path: candidate.playback_storage_path,
            mimeType: "video/mp4",
            maxLongEdge: 1280,
            maxShortEdge: 720,
          },
          thumbnail: {
            signedUploadUrl: thumbnail.data.signedUrl,
            path: candidate.thumbnail_storage_path,
            mimeType: "image/webp",
          },
          callback: {
            url: callbackUrl,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        });

        const { data: marked, error: markError } = await admin.rpc("mark_tour_processing_dispatched", {
          p_tour_id: candidate.tour_id,
          p_lease_token: candidate.lease_token,
          p_processor_name: result.processorName,
          p_processor_job_id: result.processorJobId,
        });
        // Once the provider accepts the job, do not invalidate the lease merely
        // because recording provider metadata had a transient failure. The
        // signed callback still has the lease token and can finalize safely.
        if (markError || marked !== true) {
          console.error("Tour dispatch metadata could not be persisted", {
            requestId,
            tourId: candidate.tour_id,
            error: markError?.message,
          });
        }
        dispatched += 1;
      } catch (error) {
        failed += 1;
        const code = error instanceof Error
          ? error.message.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 80)
          : "processor_dispatch_failed";
        failures.push({ tourId: candidate.tour_id, code });
        const { error: failError } = await admin.rpc("fail_tour_processing", {
          p_tour_id: candidate.tour_id,
          p_lease_token: candidate.lease_token,
          p_failure_code: code || "processor_dispatch_failed",
          p_failure_message: "The processing job could not be dispatched.",
          p_retryable: true,
        });
        if (failError) {
          console.error("Tour dispatch failure could not be persisted", {
            requestId,
            tourId: candidate.tour_id,
            error: failError.message,
          });
        }
      }
    }

    return json(req, failed > 0 ? 207 : 200, {
      requestId,
      claimed: candidates.length,
      dispatched,
      failed,
      failures,
    });
  } catch (error) {
    console.error("Tour processing worker failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "processing_worker_unavailable",
      message: "Tour processing is temporarily unavailable.",
    });
  }
});
