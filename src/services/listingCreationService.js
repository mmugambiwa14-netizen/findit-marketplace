import {
  deleteStagedListingImage,
  insertListingSubmission,
  invokeListingImageUpload,
  replaceListingMediaRows,
  signListingImagePaths,
  transitionOwnerListing,
} from '@/repositories/listingCreationRepository';
import {
  isTrustedListingImagePath,
  normalizeListingImageFile,
  normalizeListingMediaReplacement,
  normalizeListingSubmission,
  normalizeOwnerListingAction,
} from '@/services/listingSubmissionContracts';

export function submitListing(ownerId, input) {
  return insertListingSubmission(normalizeListingSubmission(ownerId, input));
}

export function changeOwnerListingState(listingId, action) {
  return transitionOwnerListing(normalizeOwnerListingAction(listingId, action));
}

export function uploadListingImage(file) {
  return invokeListingImageUpload(normalizeListingImageFile(file));
}

export async function removeStagedListingImage(path) {
  if (!isTrustedListingImagePath(path)) throw new TypeError('Image path is invalid');
  await deleteStagedListingImage(path);
}

export function replaceListingMedia(listingId, keepPaths, uploads) {
  return replaceListingMediaRows(normalizeListingMediaReplacement(listingId, keepPaths, uploads));
}

function safeLegacyUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function resolveListingImages(values) {
  const photos = Array.isArray(values) ? values : [];
  const storagePaths = photos.filter(isTrustedListingImagePath);
  const signedByPath = new Map();
  if (storagePaths.length) {
    const signedRows = await signListingImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }
  return photos.map((value) => signedByPath.get(value) ?? safeLegacyUrl(value)).filter(Boolean);
}

export async function hydrateListingImages(rows) {
  return Promise.all((rows ?? []).map(async (row) => ({
    ...row,
    photo_paths: Array.isArray(row.photos) ? row.photos.filter(isTrustedListingImagePath) : [],
    has_legacy_media: Array.isArray(row.photos) && row.photos.some((value) => !isTrustedListingImagePath(value)),
    photos: await resolveListingImages(row.photos),
  })));
}
