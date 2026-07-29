import {
  TOUR_LIMITS,
  TOUR_MIME_EXTENSIONS,
  adminClient,
  bearerAuthorization,
  correlationId,
  isUuid,
  json,
  requireJsonRequest,
  safeFilename,
  toursBackendEnabled,
  userClient,
} from "../_shared/tour-runtime.ts";

type IntentPayload = {
  parentType?: unknown;
  parentId?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  byteSize?: unknown;
  durationSeconds?: unknown;
  sha256?: unknown;
  idempotencyKey?: unknown;
};

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!toursBackendEnabled()) {
    return json(req, 503, {
      requestId,
      code: "tours_disabled",
      message: "Tour uploads are not enabled in this environment.",
    });
  }

  const authorization = bearerAuthorization(req);
  if (!authorization) {
    return json(req, 401, {
      requestId,
      code: "authentication_required",
      message: "Sign in to upload a Tour.",
    });
  }

  try {
    const payload = await req.json() as IntentPayload;
    const parentType = payload.parentType;
    const parentId = payload.parentId;
    const mimeType = payload.mimeType;
    const byteSize = Number(payload.byteSize);
    const durationSeconds = Number(payload.durationSeconds);
    const idempotencyKey = payload.idempotencyKey;
    const checksum = typeof payload.sha256 === "string" && payload.sha256.trim()
      ? payload.sha256.trim().toLowerCase()
      : null;

    if ((parentType !== "listing" && parentType !== "service") || !isUuid(parentId)) {
      return json(req, 400, { requestId, code: "invalid_parent", message: "Choose a valid listing or service." });
    }
    if (typeof mimeType !== "string" || !TOUR_MIME_EXTENSIONS[mimeType]) {
      return json(req, 415, { requestId, code: "unsupported_video", message: "Use an MP4, MOV, or WebM video." });
    }
    if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > TOUR_LIMITS.maxSourceBytes) {
      return json(req, 413, {
        requestId,
        code: "video_too_large",
        message: "Tour videos must be 250 MB or smaller.",
      });
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > TOUR_LIMITS.maxDurationSeconds) {
      return json(req, 422, {
        requestId,
        code: "video_too_long",
        message: "Tour videos must be 2 minutes or shorter.",
      });
    }
    if (checksum && !/^[0-9a-f]{64}$/.test(checksum)) {
      return json(req, 400, { requestId, code: "invalid_checksum", message: "The video checksum is invalid." });
    }
    if (!isUuid(idempotencyKey)) {
      return json(req, 400, {
        requestId,
        code: "invalid_idempotency_key",
        message: "A valid upload idempotency key is required.",
      });
    }

    const user = userClient(authorization);
    const { data: userData, error: userError } = await user.auth.getUser();
    if (userError || !userData.user) {
      return json(req, 401, { requestId, code: "invalid_session", message: "Your session is no longer valid." });
    }

    const tourId = crypto.randomUUID();
    const objectId = crypto.randomUUID();
    const extension = TOUR_MIME_EXTENSIONS[mimeType];
    const sourcePath = `${userData.user.id}/${tourId}/source/${objectId}.${extension}`;
    const admin = adminClient();
    const { data: authorized, error: authorizeError } = await admin.rpc("authorize_tour_upload", {
      p_user_id: userData.user.id,
      p_tour_id: tourId,
      p_listing_id: parentType === "listing" ? parentId : null,
      p_service_id: parentType === "service" ? parentId : null,
      p_source_storage_path: sourcePath,
      p_original_filename: safeFilename(payload.filename),
      p_declared_mime_type: mimeType,
      p_declared_byte_size: byteSize,
      p_declared_duration_seconds: durationSeconds,
      p_sha256_hex: checksum,
      p_idempotency_key: idempotencyKey,
    });

    if (authorizeError || !Array.isArray(authorized) || !authorized[0]) {
      const message = authorizeError?.message ?? "Tour upload could not be authorized";
      const status = message.includes("rate exceeded") ? 429
        : message.includes("pending Tour") ? 409
        : message.includes("ownership") || message.includes("eligible") || message.includes("parent not found") ? 403
        : message.includes("disabled") ? 503
        : 400;
      return json(req, status, {
        requestId,
        code: status === 429 ? "rate_limited" : status === 409 ? "replacement_in_progress" : "upload_not_authorized",
        message: status === 429
          ? "Too many Tour uploads were started. Try again later."
          : status === 409
          ? "This item already has a Tour upload in progress."
          : "This Tour upload could not be authorized.",
      });
    }

    const intent = authorized[0] as {
      intent_id: string;
      tour_id: string;
      source_storage_path: string;
      expires_at: string;
    };
    // Generate the signed upload under the authenticated seller JWT so
    // Storage records owner_id from the user subject. The storage policy also
    // requires this exact active server-created intent path.
    const { data: signed, error: signedError } = await user.storage
      .from("tour-sources")
      .createSignedUploadUrl(intent.source_storage_path, { upsert: false });
    if (signedError || !signed?.token) {
      // Keep the bounded intent authorized so the same idempotency key can be
      // retried. Its expiry is handled by the cleanup worker if no upload occurs.
      return json(req, 502, {
        requestId,
        code: "signed_upload_unavailable",
        message: "The Tour upload could not be prepared. Try again.",
      });
    }

    return json(req, 201, {
      requestId,
      intentId: intent.intent_id,
      tourId: intent.tour_id,
      bucket: "tour-sources",
      path: intent.source_storage_path,
      uploadToken: signed.token,
      signedUploadUrl: signed.signedUrl,
      expiresAt: intent.expires_at,
      limits: {
        maxDurationSeconds: TOUR_LIMITS.maxDurationSeconds,
        maxSourceBytes: TOUR_LIMITS.maxSourceBytes,
      },
    });
  } catch (error) {
    console.error("tour upload intent failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "upload_intent_unavailable",
      message: "Tour upload is temporarily unavailable.",
    });
  }
});
