import {
  TOUR_LIMITS,
  adminClient,
  bearerAuthorization,
  correlationId,
  isUuid,
  json,
  requireJsonRequest,
  toursBackendEnabled,
  userClient,
} from "../_shared/tour-runtime.ts";

async function signedUrl(
  bucket: string,
  path: unknown,
): Promise<string | null> {
  if (typeof path !== "string" || !path.trim()) return null;
  const { data, error } = await adminClient().storage
    .from(bucket)
    .createSignedUrl(path, TOUR_LIMITS.signedPlaybackLifetimeSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();

  if (!toursBackendEnabled()) {
    return json(req, 404, { requestId, code: "tour_not_found", message: "Tour not found." });
  }

  const authorization = bearerAuthorization(req);
  if (!authorization) {
    return json(req, 401, { requestId, code: "authentication_required", message: "Sign in is required." });
  }

  try {
    const payload = await req.json() as { tourId?: unknown };
    if (!isUuid(payload.tourId)) {
      return json(req, 400, { requestId, code: "invalid_tour", message: "A valid Tour is required." });
    }

    const browser = userClient(authorization);
    const { data, error } = await browser.rpc("admin_tour_review_metadata", {
      p_tour_id: payload.tourId,
    });
    const metadata = Array.isArray(data) ? data[0] : null;
    if (error) {
      const forbidden = error.code === "42501" || /admin access required/i.test(error.message ?? "");
      return json(req, forbidden ? 403 : 404, {
        requestId,
        code: forbidden ? "admin_required" : "tour_not_found",
        message: forbidden ? "Admin access is required." : "Tour not found.",
      });
    }
    if (!metadata) {
      return json(req, 404, { requestId, code: "tour_not_found", message: "Tour not found." });
    }

    const [playbackUrl, thumbnailUrl] = await Promise.all([
      signedUrl("tour-playback", metadata.playback_storage_path),
      signedUrl("tour-thumbnails", metadata.thumbnail_storage_path),
    ]);

    return json(req, 200, {
      requestId,
      tourId: metadata.tour_id,
      parentType: metadata.parent_type,
      parentId: metadata.parent_id,
      status: metadata.status,
      moderationStatus: metadata.moderation_status,
      durationSeconds: metadata.duration_seconds == null ? null : Number(metadata.duration_seconds),
      width: metadata.width,
      height: metadata.height,
      playbackUrl,
      thumbnailUrl,
      expiresInSeconds: TOUR_LIMITS.signedPlaybackLifetimeSeconds,
    });
  } catch (error) {
    console.error("Admin Tour review access failed", { requestId, error });
    return json(req, 500, {
      requestId,
      code: "review_access_unavailable",
      message: "Tour review media is temporarily unavailable.",
    });
  }
});
