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

type FeedRequest = {
  category?: unknown;
  location?: unknown;
  query?: unknown;
  cursor?: { publishedAt?: unknown; id?: unknown } | null;
  limit?: unknown;
};

type FeedRow = {
  tour_id: string;
  parent_type: "listing" | "service";
  parent_id: string;
  listing_type: "property" | "car" | "machinery" | "service";
  title: string;
  price: number | null;
  currency: string;
  pricing_type: string | null;
  public_location: string;
  cover_storage_path: string | null;
  thumbnail_storage_path: string;
  duration_seconds: number;
  availability: string;
  summary_attributes: unknown;
  seller_id: string;
  seller_display_name: string;
  seller_type: string;
  published_at: string;
};

const CATEGORIES = new Set(["all", "property", "car", "machinery", "service"]);
const LEGACY_URL = /^https?:\/\//i;
const LOCAL_INTERNAL_ORIGIN = "http://kong:8000";

function browserReachableUrl(req: Request, value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(LOCAL_INTERNAL_ORIGIN)) return value;
  return `${new URL(req.url).origin}${value.slice(LOCAL_INTERNAL_ORIGIN.length)}`;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalize(payload: FeedRequest) {
  const category = text(payload.category, 24).toLowerCase() || "all";
  if (!CATEGORIES.has(category)) throw new TypeError("invalid_category");
  const location = text(payload.location, 120);
  const query = text(payload.query, 100);
  const limit = payload.limit == null ? 8 : Number(payload.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) throw new TypeError("invalid_limit");

  const cursor = payload.cursor ?? null;
  if (cursor === null) return { category, location, query, limit, cursorPublishedAt: null, cursorId: null };
  if (typeof cursor !== "object" || !isUuid(cursor.id) || typeof cursor.publishedAt !== "string") {
    throw new TypeError("invalid_cursor");
  }
  const publishedAt = new Date(cursor.publishedAt);
  if (!Number.isFinite(publishedAt.getTime())) throw new TypeError("invalid_cursor");
  return {
    category,
    location,
    query,
    limit,
    cursorPublishedAt: publishedAt.toISOString(),
    cursorId: cursor.id.toLowerCase(),
  };
}

async function signByBucket(
  admin: ReturnType<typeof adminClient>,
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await admin.storage.from(bucket).createSignedUrls(
    unique,
    TOUR_LIMITS.signedCardAssetLifetimeSeconds,
  );
  if (error) throw error;
  const signed = new Map<string, string>();
  unique.forEach((path, index) => {
    const url = data?.[index]?.signedUrl;
    if (url) signed.set(path, url);
  });
  return signed;
}

Deno.serve(async (req: Request) => {
  const early = requireJsonRequest(req);
  if (early) return early;
  const requestId = correlationId();
  const startedAt = performance.now();

  if (!toursBackendEnabled()) {
    return json(req, 404, { requestId, code: "tours_unavailable", message: "Tours are unavailable." });
  }

  try {
    const request = normalize(await req.json() as FeedRequest);
    const admin = adminClient();
    const { data, error } = await admin.rpc("public_tour_feed", {
      p_category: request.category,
      p_location: request.location,
      p_query: request.query,
      p_cursor_published_at: request.cursorPublishedAt,
      p_cursor_id: request.cursorId,
      p_limit: request.limit,
    });
    if (error) throw error;

    const rows = (Array.isArray(data) ? data : []) as FeedRow[];
    const hasMore = rows.length > request.limit;
    const pageRows = rows.slice(0, request.limit);
    const [tourThumbnails, listingCovers, serviceCovers] = await Promise.all([
      signByBucket(admin, "tour-thumbnails", pageRows.map((row) => row.thumbnail_storage_path)),
      signByBucket(admin, "listing-images", pageRows
        .filter((row) => row.parent_type === "listing" && row.cover_storage_path && !LEGACY_URL.test(row.cover_storage_path))
        .map((row) => row.cover_storage_path as string)),
      signByBucket(admin, "marketplace-images", pageRows
        .filter((row) => row.parent_type === "service" && row.cover_storage_path && !LEGACY_URL.test(row.cover_storage_path))
        .map((row) => row.cover_storage_path as string)),
    ]);

    const items = pageRows.map((row) => {
      const coverPath = row.cover_storage_path;
      const coverImageUrl = coverPath
        ? LEGACY_URL.test(coverPath)
          ? coverPath
          : row.parent_type === "service"
            ? serviceCovers.get(coverPath) ?? null
            : listingCovers.get(coverPath) ?? null
        : null;
      return {
        tourId: row.tour_id,
        parentType: row.parent_type,
        parentId: row.parent_id,
        listingType: row.listing_type,
        title: row.title,
        price: row.price == null ? null : Number(row.price),
        currency: row.currency,
        pricingType: row.pricing_type,
        publicLocation: row.public_location,
        coverImageUrl: browserReachableUrl(req, coverImageUrl),
        thumbnailUrl: browserReachableUrl(req, tourThumbnails.get(row.thumbnail_storage_path) ?? coverImageUrl),
        durationSeconds: Number(row.duration_seconds),
        availability: row.availability,
        summaryAttributes: Array.isArray(row.summary_attributes)
          ? row.summary_attributes.filter((value) => typeof value === "string").slice(0, 3)
          : [],
        sellerId: row.seller_id,
        sellerDisplayName: row.seller_display_name,
        sellerType: row.seller_type,
        publishedAt: row.published_at,
      };
    });

    const last = hasMore ? pageRows.at(-1) : null;
    const responseBody = {
      requestId,
      items,
      nextCursor: last ? { publishedAt: last.published_at, id: last.tour_id } : null,
      signedAssetLifetimeSeconds: TOUR_LIMITS.signedCardAssetLifetimeSeconds,
    };
    if (shouldSample(requestId, 100)) {
      const responseBytes = new TextEncoder().encode(JSON.stringify(responseBody)).byteLength;
      await Promise.all([
        recordOperationalMetric(admin, {
          name: "feed_latency_ms",
          value: elapsedMilliseconds(startedAt),
          dimension: request.category,
          sampleCount: 100,
          metadata: { itemCount: items.length, hasMore },
        }),
        recordOperationalMetric(admin, {
          name: "feed_response_bytes",
          value: responseBytes,
          dimension: request.category,
          sampleCount: 100,
        }),
      ]);
    }
    return json(req, 200, responseBody);
  } catch (error) {
    const code = error instanceof TypeError ? error.message : "tour_feed_unavailable";
    const status = error instanceof TypeError ? 400 : 503;
    console.error("Tour feed failed", { requestId, error });
    if (status === 503) {
      try {
        await recordOperationalMetric(adminClient(), {
          name: "feed_failed",
          value: 1,
          dimension: "all",
          metadata: { code },
        });
      } catch {
        // The primary failure remains the response; telemetry is best effort.
      }
    }
    return json(req, status, {
      requestId,
      code,
      message: status === 400 ? "The Tours request is invalid." : "Tours are temporarily unavailable.",
    });
  }
});
