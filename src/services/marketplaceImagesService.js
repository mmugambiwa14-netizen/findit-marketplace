import {
  attachMarketplaceImageRow,
  deleteMarketplaceImageObjects,
  detachMarketplaceImageRow,
  invokeMarketplaceImageUpload,
  replaceServiceMediaRows,
  signMarketplaceImagePaths,
} from '@/repositories/marketplaceImagesRepository';
import {
  isTrustedMarketplaceImagePath,
  normalizeMarketplaceImageAttachment,
  normalizeMarketplaceImageDetachment,
  normalizeMarketplaceImageFile,
  normalizeMarketplaceImagePurpose,
  normalizeServiceMediaReplacement,
} from '@/services/marketplaceImageContracts';

export function uploadMarketplaceImage(file, purpose) {
  return invokeMarketplaceImageUpload(
    normalizeMarketplaceImageFile(file),
    normalizeMarketplaceImagePurpose(purpose),
  );
}

export function attachMarketplaceImage(input) {
  return attachMarketplaceImageRow(normalizeMarketplaceImageAttachment(input));
}

export async function removeStagedMarketplaceImage(path, purpose) {
  if (!isTrustedMarketplaceImagePath(path, purpose)) throw new TypeError('Image path is invalid');
  await deleteMarketplaceImageObjects([path]);
}

export async function detachMarketplaceImage(targetKind, targetId, path) {
  const request = normalizeMarketplaceImageDetachment(targetKind, targetId, path);
  await detachMarketplaceImageRow(request);
  await deleteMarketplaceImageObjects([request.path]);
}

export async function replaceServiceMedia(targetId, keepPaths, uploads) {
  return replaceServiceMediaRows(normalizeServiceMediaReplacement(targetId, keepPaths, uploads));
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

function imageValues(row) {
  return Array.isArray(row?.photos) ? row.photos : [];
}

function firstDisplayableImage(row, purpose) {
  return imageValues(row).find((value) => (
    isTrustedMarketplaceImagePath(value, purpose) || safeLegacyUrl(value)
  )) ?? null;
}

/**
 * Resolves one visible cover image per marketplace card in a single signed URL
 * batch. Full path metadata is retained so owner/detail boundaries can still
 * reason about media without signing non-visible gallery objects on browse.
 */
export async function hydrateMarketplaceCardImages(rows, purpose) {
  const normalizedPurpose = normalizeMarketplaceImagePurpose(purpose);
  const values = Array.isArray(rows) ? rows : [];
  const covers = values.map((row) => firstDisplayableImage(row, normalizedPurpose));
  const storagePaths = [...new Set(
    covers.filter((value) => isTrustedMarketplaceImagePath(value, normalizedPurpose)),
  )];
  const signedByPath = new Map();

  if (storagePaths.length) {
    const signedRows = await signMarketplaceImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }

  return values.map((row, index) => {
    const photos = imageValues(row);
    const cover = covers[index];
    const resolvedCover = cover ? (signedByPath.get(cover) ?? safeLegacyUrl(cover)) : null;
    return {
      ...row,
      photo_paths: photos.filter((value) => isTrustedMarketplaceImagePath(value, normalizedPurpose)),
      has_legacy_media: photos.some((value) => !isTrustedMarketplaceImagePath(value, normalizedPurpose)),
      photos: resolvedCover ? [resolvedCover] : [],
    };
  });
}

export async function resolveMarketplaceImages(values, purpose) {
  const normalizedPurpose = normalizeMarketplaceImagePurpose(purpose);
  const images = Array.isArray(values) ? values : [];
  const storagePaths = images.filter((value) => isTrustedMarketplaceImagePath(value, normalizedPurpose));
  const signedByPath = new Map();
  if (storagePaths.length) {
    const signedRows = await signMarketplaceImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }
  return images.map((value) => signedByPath.get(value) ?? safeLegacyUrl(value)).filter(Boolean);
}

export async function resolveMarketplaceImage(value, purpose) {
  return (await resolveMarketplaceImages(value ? [value] : [], purpose))[0] ?? null;
}
