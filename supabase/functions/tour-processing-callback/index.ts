import {
  adminClient,
  constantTimeEqual,
  correlationId,
  hmacSha256Hex,
  isUuid,
  json,
  requireJsonRequest,
  toursBackendEnabled,
} from "../_shared/tour-runtime.ts";

type CallbackPayload = {
  status?: unknown;
  tourId?: unknown;
  leaseToken?: unknown;
  processorJobId?: unknown;
  durationSeconds?: unknown;
  width?: unknown;
  height?: unknown;
  processedByteSize?: unknown;
  container?: unknown;
  videoCodec?: unknown;
  audioCodec?: unknown;
  checksumSha256?: unknown;
  failureCode?: unknown;
  failureMessage?: unknown;
  retryable?: unknown;
};

function token(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return new RegExp(`^[a-z0-9._-]{1,${max}}$`).test(normalized) ? normalized : null;
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!toursBackendEnabled()) {
    return json(req, 503, { requestId, code: "tours_disabled", message: "Tour processing is disabled." });
  }

  try {
    const secret = Deno.env.get("TOUR_PROCESSOR_SECRET");
    if (!secret) throw new Error("Missing TOUR_PROCESSOR_SECRET");
    const timestampHeader = req.headers.get("x-findit-timestamp") ?? "";
    const signature = req.headers.get("x-findit-signature") ?? "";
    const timestamp = Number(timestampHeader);
    if (!Number.isInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      return json(req, 401, { requestId, code: "stale_callback", message: "The callback timestamp is invalid." });
    }

    const rawBody = await req.text();
    const expected = await hmacSha256Hex(secret, `${timestampHeader}.${rawBody}`);
    if (!constantTimeEqual(signature.toLowerCase(), expected)) {
      return json(req, 401, { requestId, code: "invalid_signature", message: "The callback signature is invalid." });
    }

    const payload = JSON.parse(rawBody) as CallbackPayload;
    if (!isUuid(payload.tourId) || !isUuid(payload.leaseToken)) {
      return json(req, 400, { requestId, code: "invalid_job", message: "The processing job identity is invalid." });
    }
    if (payload.status !== "succeeded" && payload.status !== "failed" && payload.status !== "processing") {
      return json(req, 400, { requestId, code: "invalid_status", message: "The callback status is invalid." });
    }
    const processorJobId = typeof payload.processorJobId === "string"
      ? payload.processorJobId.trim().slice(0, 255)
      : "";
    if (!processorJobId) {
      return json(req, 400, { requestId, code: "invalid_job", message: "The processor job identity is required." });
    }

    const admin = adminClient();
    const { data: callbackAuthorized, error: authorizationError } = await admin.rpc(
      "authorize_tour_processing_callback",
      {
        p_tour_id: payload.tourId,
        p_lease_token: payload.leaseToken,
        p_processor_job_id: processorJobId,
      },
    );
    if (authorizationError) throw new Error(authorizationError.message);
    if (callbackAuthorized !== true) {
      const { data: existing } = await admin.from("listing_tours")
        .select("status,processor_job_id")
        .eq("id", payload.tourId)
        .maybeSingle();
      const duplicateReady = payload.status === "succeeded" && existing?.status === "ready";
      const duplicateFailed = payload.status === "failed" && existing?.status === "failed";
      if (existing?.processor_job_id === processorJobId && (duplicateReady || duplicateFailed)) {
        return json(req, 200, {
          requestId,
          accepted: true,
          duplicate: true,
          status: existing.status,
        });
      }
      return json(req, 409, {
        requestId,
        code: "stale_processing_job",
        message: "The processing lease or processor job is no longer active.",
      });
    }

    if (payload.status === "processing") {
      const { data, error } = await admin.rpc("heartbeat_tour_processing", {
        p_tour_id: payload.tourId,
        p_lease_token: payload.leaseToken,
        p_extend_minutes: 20,
      });
      if (error || data !== true) {
        return json(req, 409, { requestId, code: "stale_processing_lease", message: "The processing lease is no longer active." });
      }
      return json(req, 200, { requestId, accepted: true, status: "processing" });
    }

    if (payload.status === "failed") {
      const failureCode = token(payload.failureCode, 80) ?? "processor_failed";
      const failureMessage = typeof payload.failureMessage === "string" && payload.failureMessage.trim()
        ? payload.failureMessage.trim().slice(0, 1000)
        : "The Tour processor could not prepare this video.";
      const { data, error } = await admin.rpc("fail_tour_processing", {
        p_tour_id: payload.tourId,
        p_lease_token: payload.leaseToken,
        p_failure_code: failureCode.replace(/[.-]/g, "_"),
        p_failure_message: failureMessage,
        p_retryable: payload.retryable !== false,
      });
      if (error) throw new Error(error.message);
      if (data !== true) {
        const { data: existing } = await admin.from("listing_tours")
          .select("status,processor_job_id")
          .eq("id", payload.tourId)
          .maybeSingle();
        if (existing?.status === "failed") {
          return json(req, 200, { requestId, accepted: true, duplicate: true, status: "failed" });
        }
        return json(req, 409, { requestId, code: "stale_processing_lease", message: "The processing lease is no longer active." });
      }
      return json(req, 200, { requestId, accepted: true, status: "failed" });
    }

    const container = token(payload.container, 40);
    const videoCodec = token(payload.videoCodec, 40);
    const audioCodec = payload.audioCodec === null || payload.audioCodec === undefined
      ? null
      : token(payload.audioCodec, 40);
    const checksum = typeof payload.checksumSha256 === "string" && /^[0-9a-f]{64}$/i.test(payload.checksumSha256)
      ? payload.checksumSha256.toLowerCase()
      : null;
    const duration = Number(payload.durationSeconds);
    const width = Number(payload.width);
    const height = Number(payload.height);
    const processedBytes = Number(payload.processedByteSize);
    if (!container || !videoCodec || (payload.audioCodec != null && !audioCodec)
      || !Number.isFinite(duration) || !Number.isInteger(width) || !Number.isInteger(height)
      || !Number.isInteger(processedBytes)) {
      return json(req, 400, { requestId, code: "invalid_output_metadata", message: "Processed media metadata is incomplete." });
    }

    const { data, error } = await admin.rpc("finalize_tour_processing", {
      p_tour_id: payload.tourId,
      p_lease_token: payload.leaseToken,
      p_duration_seconds: duration,
      p_width: width,
      p_height: height,
      p_processed_byte_size: processedBytes,
      p_detected_container: container,
      p_detected_video_codec: videoCodec,
      p_detected_audio_codec: audioCodec,
      p_checksum_sha256: checksum,
    });
    if (error) {
      await admin.rpc("fail_tour_processing", {
        p_tour_id: payload.tourId,
        p_lease_token: payload.leaseToken,
        p_failure_code: "output_validation_failed",
        p_failure_message: "The processed Tour output failed server validation.",
        p_retryable: false,
      });
      return json(req, 422, { requestId, code: "output_validation_failed", message: "Processed media validation failed." });
    }
    if (data !== true) {
      const { data: existing } = await admin.from("listing_tours")
        .select("status,processor_job_id")
        .eq("id", payload.tourId)
        .maybeSingle();
      if (existing?.status === "ready") {
        return json(req, 200, { requestId, accepted: true, duplicate: true, status: "ready" });
      }
      return json(req, 409, { requestId, code: "stale_processing_lease", message: "The processing lease is no longer active." });
    }

    return json(req, 200, { requestId, accepted: true, status: "ready" });
  } catch (error) {
    console.error("Tour processing callback failed", { requestId, error });
    return json(req, 500, { requestId, code: "callback_unavailable", message: "The processing callback could not be completed." });
  }
});
