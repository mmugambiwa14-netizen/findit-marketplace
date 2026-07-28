import {
  TOUR_LIMITS,
  adminClient,
  correlationId,
  elapsedMilliseconds,
  isUuid,
  json,
  recordOperationalMetric,
  requireJsonRequest,
  shouldSample,
  toursBackendEnabled,
} from "../_shared/tour-runtime.ts";

const LOCAL_INTERNAL_ORIGIN = "http://kong:8000";

function browserReachableUrl(req: Request, value: string): string {
  if (!value.startsWith(LOCAL_INTERNAL_ORIGIN)) return value;
  return `${new URL(req.url).origin}${value.slice(LOCAL_INTERNAL_ORIGIN.length)}`;
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();
  const startedAt = performance.now();

  if (!toursBackendEnabled()) {
    return json(req, 404, { requestId, code: "tour_not_found", message: "Tour not found." });
  }

  try {
    const payload = await req.json() as { parentType?: unknown; parentId?: unknown };
    if ((payload.parentType !== "listing" && payload.parentType !== "service") || !isUuid(payload.parentId)) {
      return json(req, 400, { requestId, code: "invalid_parent", message: "A valid Tour parent is required." });
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc("public_tour_metadata", {
      p_listing_id: payload.parentType === "listing" ? payload.parentId : null,
      p_service_id: payload.parentType === "service" ? payload.parentId : null,
    });
    const metadata = Array.isArray(data) ? data[0] : null;
    if (error || !metadata) {
      return json(req, 404, { requestId, code: "tour_not_found", message: "Tour not found." });
    }

    const [playback, thumbnail] = await Promise.all([
      admin.storage.from("tour-playback").createSignedUrl(
        metadata.playback_storage_path,
        TOUR_LIMITS.signedPlaybackLifetimeSeconds,
      ),
      admin.storage.from("tour-thumbnails").createSignedUrl(
        metadata.thumbnail_storage_path,
        TOUR_LIMITS.signedPlaybackLifetimeSeconds,
      ),
    ]);
    if (playback.error || !playback.data?.signedUrl || thumbnail.error || !thumbnail.data?.signedUrl) {
      await recordOperationalMetric(admin, {
        name: "playback_access_failed",
        value: 1,
        dimension: metadata.parent_type,
      });
      return json(req, 503, {
        requestId,
        code: "playback_unavailable",
        message: "This Tour is temporarily unavailable.",
      });
    }

    const responseBody = {
      requestId,
      tourId: metadata.tour_id,
      parentType: metadata.parent_type,
      parentId: metadata.parent_id,
      durationSeconds: Number(metadata.duration_seconds),
      width: metadata.width,
      height: metadata.height,
      playbackUrl: browserReachableUrl(req, playback.data.signedUrl),
      thumbnailUrl: browserReachableUrl(req, thumbnail.data.signedUrl),
      expiresInSeconds: TOUR_LIMITS.signedPlaybackLifetimeSeconds,
      publishedAt: metadata.published_at,
    };
    if (shouldSample(requestId, 100)) {
      await recordOperationalMetric(admin, {
        name: "playback_access_latency_ms",
        value: elapsedMilliseconds(startedAt),
        dimension: metadata.parent_type,
        sampleCount: 100,
      });
    }
    return json(req, 200, responseBody);
  } catch (error) {
    console.error("Tour playback access failed", { requestId, error });
    try {
      await recordOperationalMetric(adminClient(), {
        name: "playback_access_failed",
        value: 1,
        dimension: "all",
      });
    } catch {
      // Preserve the primary failure response when telemetry is unavailable.
    }
    return json(req, 500, {
      requestId,
      code: "playback_access_unavailable",
      message: "Tour playback is temporarily unavailable.",
    });
  }
});
