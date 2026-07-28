import { featureFlags } from '@/lib/featureFlags';
import { isPrivatePreviewHost, localPreviewModeEnabled } from '@/lib/localPreview';
import {
  approveAdminTour,
  invokePublicTourFeed,
  invokePublicTourPlayback,
  invokeAdminTourReviewAccess,
  invokeTourUploadComplete,
  invokeTourUploadIntent,
  readAdminTourQueue,
  readOwnerTourRows,
  readPublicTourSummaries,
  rejectAdminTour,
  removeOwnerTourRow,
  reportTourRow,
  retryOwnerTourRow,
  uploadTourSourceObject,
} from '@/repositories/listingToursRepository';
import {
  normalizeTourId,
  normalizeTourIntentId,
  normalizeTourFeedRequest,
  normalizeTourFeedResponse,
  normalizeTourPlaybackRequest,
  normalizeTourReport,
  normalizeTourAdminDecision,
  normalizeTourAdminQueueRequest,
  normalizeTourUploadIntent,
} from '@/services/listingTourContracts';

const LOCAL_PREVIEW_TOUR_ID = '40000000-0000-4000-8000-000000000001';
const LOCAL_PREVIEW_LISTING_ID = '20000000-0000-4000-8000-000000000001';
const LOCAL_PREVIEW_SELLER_ID = '10000000-0000-4000-8000-000000000001';

function isLocalTourPreview() {
  return featureFlags.toursPreview && localPreviewModeEnabled();
}

function localPreviewAsset(filename) {
  const origin = globalThis.location?.origin || 'http://127.0.0.1:5173';
  const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return new URL(`${basePath.replace(/^\//, '')}mock/${filename}`, `${origin}/`).toString();
}

function localPreviewPlayback(parent) {
  return {
    tourId: LOCAL_PREVIEW_TOUR_ID,
    parentType: parent.parentType,
    parentId: parent.parentId,
    durationSeconds: 8,
    width: 1280,
    height: 720,
    playbackUrl: localPreviewAsset('findit-tour-preview.mp4'),
    thumbnailUrl: localPreviewAsset('findit-tour-thumbnail.webp'),
    expiresInSeconds: 3600,
    publishedAt: '2026-07-28T00:00:00.000Z',
  };
}

function localPreviewFeedPage(request) {
  const item = {
    tourId: LOCAL_PREVIEW_TOUR_ID,
    parentType: 'listing',
    parentId: LOCAL_PREVIEW_LISTING_ID,
    listingType: 'car',
    title: 'Toyota Hilux 2.8 GD-6 double cab',
    price: 28500,
    currency: 'USD',
    pricingType: null,
    publicLocation: 'Harare',
    coverImageUrl: localPreviewAsset('findit-tour-thumbnail.webp'),
    thumbnailUrl: localPreviewAsset('findit-tour-thumbnail.webp'),
    durationSeconds: 8,
    availability: 'available',
    summaryAttributes: ['2021', '64,000 km', 'automatic'],
    sellerId: LOCAL_PREVIEW_SELLER_ID,
    sellerDisplayName: 'FindIt Preview Seller',
    sellerType: 'seller',
    publishedAt: '2026-07-28T00:00:00.000Z',
  };
  const query = request.query.toLowerCase();
  const location = request.location.toLowerCase();
  const matches = !request.cursor
    && (request.category === 'all' || request.category === item.listingType)
    && (!query || `${item.title} ${item.sellerDisplayName} ${item.publicLocation}`.toLowerCase().includes(query))
    && (!location || item.publicLocation.toLowerCase().includes(location));
  return {
    items: matches ? [item] : [],
    nextCursor: null,
    signedAssetLifetimeSeconds: 3600,
  };
}

function requireTours() {
  if (!featureFlags.tours) throw new Error('Tours are not enabled in this build');
}

function requireTourAdministration() {
  if (!featureFlags.tours && !featureFlags.toursPreview) {
    throw new Error('Tour administration is not enabled in this build');
  }
}

function progress(callback, stage, percent, message, details = {}) {
  callback?.({ stage, percent, message, ...details });
}

function browserReachableLocalUrl(value) {
  if (typeof value !== 'string') return value ?? null;
  const localSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!localSupabaseUrl) return value;

  try {
    const publicUrl = new URL(localSupabaseUrl);
    if (!isPrivatePreviewHost(publicUrl.hostname)) return value;

    const signedUrl = new URL(value);
    const internalGateway = signedUrl.hostname === 'kong' && signedUrl.port === '8000';
    const localStoragePort = isPrivatePreviewHost(signedUrl.hostname) && signedUrl.port === '8081';
    if (!internalGateway && !localStoragePort) return value;

    signedUrl.protocol = publicUrl.protocol;
    signedUrl.hostname = publicUrl.hostname;
    signedUrl.port = publicUrl.port;
    return signedUrl.toString();
  } catch {
    return value;
  }
}

/**
 * @typedef {Error & { resumeUpload?: { intentId: string, tourId?: string, path: string, uploadToken: string, expiresAt: string | null, idempotencyKey: string } }} ResumableTourError
 */

function resumableFailure(error, intent, request) {
  /** @type {ResumableTourError} */
  const failure = error instanceof Error ? error : new Error('The Tour upload was interrupted');
  failure.resumeUpload = {
    intentId: intent.intentId,
    tourId: intent.tourId,
    path: intent.path,
    uploadToken: intent.uploadToken,
    expiresAt: intent.expiresAt,
    idempotencyKey: request.idempotencyKey,
  };
  return failure;
}

async function completeUploadedTour(intentId, callback) {
  progress(callback, 'confirming', 88, 'Confirming the uploaded video');
  const completed = await invokeTourUploadComplete(normalizeTourIntentId(intentId));
  progress(callback, 'queued', 100, 'Tour queued for processing', { tourId: completed.tourId });
  return completed;
}

function authorizationExpired(resume) {
  const expiresAt = Date.parse(String(resume?.expiresAt || ''));
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5000;
}

async function recoverExpiredAuthorization(resume, request, callback) {
  // Storage may have accepted the bytes immediately before the browser lost the
  // response. Confirmation therefore comes before renewal and is safe to repeat.
  progress(callback, 'recovering', 3, 'Checking the interrupted upload');
  try {
    return { completed: await completeUploadedTour(resume.intentId, callback), intent: null };
  } catch {
    // No exact object was found. Ask the backend to renew the same server-owned
    // intent using the same idempotency key, Tour identity and object path.
  }

  progress(callback, 'renewing', 6, 'Renewing the upload authorization');
  const renewalRequest = {
    ...request,
    idempotencyKey: resume.idempotencyKey || request.idempotencyKey,
  };
  const intent = await invokeTourUploadIntent(renewalRequest);
  return { completed: null, intent, request: renewalRequest };
}

/**
 * Uploads directly to private object storage and then confirms the exact object
 * with the backend. A live signed intent is reused exactly. An expired intent is
 * first confirmed in case Storage already accepted it, then renewed in place
 * under the same idempotency key. This prevents duplicate Tour versions and
 * never removes the currently public Tour during replacement recovery.
 */
export async function uploadListingTour(input, options = {}) {
  requireTours();
  let request = normalizeTourUploadIntent(input);
  const callback = options.onProgress;
  let resume = options.resumeUpload;
  let renewedIntent = null;

  if (resume && authorizationExpired(resume)) {
    const recovery = await recoverExpiredAuthorization(resume, request, callback);
    if (recovery.completed) return recovery.completed;
    renewedIntent = recovery.intent;
    request = recovery.request;
    resume = null;
  }

  progress(callback, 'preparing', 8, resume ? 'Resuming the Tour upload' : renewedIntent ? 'Continuing the renewed Tour upload' : 'Preparing the Tour upload');
  const intent = renewedIntent || (resume
    ? {
        intentId: normalizeTourIntentId(resume.intentId),
        tourId: resume.tourId ? normalizeTourId(resume.tourId) : null,
        path: String(resume.path || ''),
        uploadToken: String(resume.uploadToken || ''),
        expiresAt: resume.expiresAt || null,
      }
    : await invokeTourUploadIntent(request));

  if (!intent.path || !intent.uploadToken) throw new Error('The Tour upload authorization is incomplete');

  progress(callback, 'uploading', 24, 'Uploading directly to private storage', {
    intentId: intent.intentId,
    expiresAt: intent.expiresAt,
  });

  try {
    await uploadTourSourceObject({
      path: intent.path,
      uploadToken: intent.uploadToken,
      file: request.file,
    });
  } catch (uploadError) {
    // A network interruption can occur after Storage accepted the bytes but
    // before the browser received success. Confirm first; if the object is not
    // there, preserve the exact signed intent for a safe retry.
    try {
      return await completeUploadedTour(intent.intentId, callback);
    } catch {
      throw resumableFailure(uploadError, intent, request);
    }
  }

  progress(callback, 'uploaded', 78, 'Video uploaded');
  try {
    return await completeUploadedTour(intent.intentId, callback);
  } catch (error) {
    throw resumableFailure(error, intent, request);
  }
}

export function resumeListingTourUpload(input, resumeUpload, onProgress) {
  return uploadListingTour(input, { resumeUpload, onProgress });
}

export function confirmListingTourUpload(intentId) {
  requireTours();
  return invokeTourUploadComplete(normalizeTourIntentId(intentId));
}

export function getOwnerTours(parentType, parentId) {
  requireTours();
  return readOwnerTourRows(normalizeTourPlaybackRequest(parentType, parentId));
}

export function getPublicTourPlayback(parentType, parentId) {
  requireTours();
  const parent = normalizeTourPlaybackRequest(parentType, parentId);
  if (isLocalTourPreview()) return Promise.resolve(localPreviewPlayback(parent));
  return invokePublicTourPlayback(parent);
}

export function removeListingTour(tourId) {
  requireTours();
  return removeOwnerTourRow(normalizeTourId(tourId));
}

export function retryListingTour(tourId) {
  requireTours();
  return retryOwnerTourRow(normalizeTourId(tourId));
}

export function reportListingTour(input) {
  requireTours();
  return reportTourRow(normalizeTourReport(input));
}

export async function getAdminTourQueue(filters) {
  requireTourAdministration();
  const request = normalizeTourAdminQueueRequest(filters);
  const rows = await readAdminTourQueue(request);
  const hasMore = rows.length > request.limit;
  const pageRows = rows.slice(0, request.limit);
  const items = pageRows.map((row) => ({
    ...row,
    duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    report_count: Number(row.report_count ?? 0),
    owner_rejected_tour_count: Number(row.owner_rejected_tour_count ?? 0),
    reported_priority: Number(row.reported_priority ?? 1),
    failed_priority: Number(row.failed_priority ?? 1),
  }));
  const last = hasMore ? items.at(-1) : null;
  return {
    items,
    nextCursor: last ? {
      reportedPriority: last.reported_priority,
      failedPriority: last.failed_priority,
      at: last.sort_at,
      id: last.tour_id,
    } : null,
  };
}

export function getAdminTourReviewAccess(tourId) {
  requireTourAdministration();
  return invokeAdminTourReviewAccess(normalizeTourId(tourId));
}

export function approveListingTour(tourId, reason) {
  requireTourAdministration();
  const decision = normalizeTourAdminDecision(tourId, reason);
  return approveAdminTour(decision.tourId, decision.reason);
}

export function rejectListingTour(tourId, reason) {
  requireTourAdministration();
  const decision = normalizeTourAdminDecision(tourId, reason);
  return rejectAdminTour(decision.tourId, decision.reason);
}

function uniqueParentIds(items) {
  return [...new Set((items ?? [])
    .map((item) => item?.id)
    .filter((id) => typeof id === 'string' && id.trim()))];
}

function mapTourSummary(row) {
  return {
    id: row.tour_id,
    status: 'ready',
    moderationStatus: 'approved',
    durationSeconds: Number(row.duration_seconds) || null,
    publishedAt: row.published_at || null,
    isReady: true,
  };
}

export async function attachPublicTourSummaries(items, parentType) {
  if (!featureFlags.tours || !Array.isArray(items) || items.length === 0) return items ?? [];
  if (isLocalTourPreview()) {
    return items.map((item) => ({
      ...item,
      tour: parentType === 'listing' && item.id === LOCAL_PREVIEW_LISTING_ID
        ? {
            id: LOCAL_PREVIEW_TOUR_ID,
            status: 'ready',
            moderationStatus: 'approved',
            durationSeconds: 8,
            publishedAt: '2026-07-28T00:00:00.000Z',
            isReady: true,
          }
        : null,
    }));
  }
  const ids = uniqueParentIds(items);
  if (!ids.length) return items;

  try {
    const rows = await readPublicTourSummaries({
      listingIds: parentType === 'listing' ? ids : [],
      serviceIds: parentType === 'service' ? ids : [],
    });
    const byParent = new Map(rows.map((row) => [row.parent_id, mapTourSummary(row)]));
    return items.map((item) => ({ ...item, tour: byParent.get(item.id) ?? null }));
  } catch {
    // A Tour metadata outage must degrade to the canonical image-only listing.
    return items.map((item) => ({ ...item, tour: null }));
  }
}

export async function tryGetPublicTourPlayback(parentType, parentId) {
  if (!featureFlags.tours) return null;
  try {
    const playback = await getPublicTourPlayback(parentType, parentId);
    if (!playback?.tourId || !playback?.playbackUrl || !playback?.thumbnailUrl) return null;
    return {
      id: playback.tourId,
      status: 'ready',
      moderationStatus: 'approved',
      durationSeconds: Number(playback.durationSeconds) || null,
      width: playback.width ?? null,
      height: playback.height ?? null,
      playbackUrl: browserReachableLocalUrl(playback.playbackUrl),
      thumbnailUrl: browserReachableLocalUrl(playback.thumbnailUrl),
      expiresInSeconds: playback.expiresInSeconds ?? null,
      publishedAt: playback.publishedAt ?? null,
      isReady: true,
    };
  } catch {
    // Tour playback failure must never make the canonical listing unavailable.
    return null;
  }
}



export async function getPublicTourFeedPage(input) {
  requireTours();
  const request = normalizeTourFeedRequest(input);
  if (isLocalTourPreview()) return localPreviewFeedPage(request);
  const page = normalizeTourFeedResponse(await invokePublicTourFeed(request));
  return {
    ...page,
    items: page.items.map((item) => ({
      ...item,
      coverImageUrl: browserReachableLocalUrl(item.coverImageUrl),
      thumbnailUrl: browserReachableLocalUrl(item.thumbnailUrl),
    })),
  };
}

export function publicTourDetailPath(item, { openTour = true } = {}) {
  const segment = item.parentType === 'service' ? 'service' : item.listingType;
  const base = `/${segment}/${item.parentId}`;
  return openTour ? `${base}?media=tour` : base;
}
