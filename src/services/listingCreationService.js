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
import { supabase } from '@/lib/supabaseClient';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_COMPATIBILITY_DIMENSION = 4096;
const COMPATIBILITY_CODES = new Set(['unsupported_image', 'mime_mismatch']);

export async function submitListing(ownerId, input) {
  const { data: allowed, error } = await supabase.rpc('can_publish_in_category', {
    p_category: input.kind,
  });
  if (error) throw error;
  if (!allowed) {
    const failure = new Error('Your business is not approved to publish in this category.');
    failure.code = 'BUSINESS_CATEGORY_NOT_APPROVED';
    throw failure;
  }
  return insertListingSubmission(normalizeListingSubmission(ownerId, input));
}

export function changeOwnerListingState(listingId, action) {
  return transitionOwnerListing(normalizeOwnerListingAction(listingId, action));
}

function shouldRetryAsJpeg(error) {
  return error?.status === 415 || COMPATIBILITY_CODES.has(error?.code);
}

async function decodeForCompatibility(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw(context, width, height) {
          context.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
        },
      };
    } catch {
      // Fall through to the image-element decoder used by older mobile browsers.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This phone image cannot be prepared for upload'));
      element.src = objectUrl;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw(context, width, height) {
        context.drawImage(image, 0, 0, width, height);
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This phone image could not be converted')),
      'image/jpeg',
      quality,
    );
  });
}

async function convertPhoneImageToJpeg(file) {
  const decoded = await decodeForCompatibility(file);
  if (!decoded.width || !decoded.height) throw new Error('This phone image could not be read');

  const scale = Math.min(1, MAX_COMPATIBILITY_DIMENSION / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This phone image could not be prepared');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  decoded.draw(context, width, height);

  let blob = null;
  for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= MAX_UPLOAD_BYTES) break;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('This photo is too large. Choose a smaller version and try again.');
  }

  const baseName = String(file.name || 'listing-photo').replace(/\.[^.]+$/, '') || 'listing-photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export async function uploadListingImage(file) {
  const normalized = normalizeListingImageFile(file);
  try {
    return await invokeListingImageUpload(normalized);
  } catch (error) {
    if (!shouldRetryAsJpeg(error)) throw error;
    const compatibleFile = await convertPhoneImageToJpeg(file);
    return invokeListingImageUpload(normalizeListingImageFile(compatibleFile));
  }
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

function listingPhotoValues(row) {
  return Array.isArray(row?.photos) ? row.photos : [];
}

function firstDisplayablePhoto(row) {
  return listingPhotoValues(row).find((value) => isTrustedListingImagePath(value) || safeLegacyUrl(value)) ?? null;
}

function listingMediaMetadata(row) {
  const photos = listingPhotoValues(row);
  return {
    photo_paths: photos.filter(isTrustedListingImagePath),
    has_legacy_media: photos.some((value) => !isTrustedListingImagePath(value)),
  };
}

export async function resolveListingImages(values) {
  const photos = Array.isArray(values) ? values : [];
  const storagePaths = [...new Set(photos.filter(isTrustedListingImagePath))];
  const signedByPath = new Map();
  if (storagePaths.length) {
    const signedRows = await signListingImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }
  return photos.map((value) => signedByPath.get(value) ?? safeLegacyUrl(value)).filter(Boolean);
}

/**
 * Hydrates only the cover image required by marketplace cards. Full photo path
 * metadata is retained for trusted boundaries, but non-visible gallery images
 * are not signed until a detail or edit surface actually needs them.
 */
export async function hydrateListingCardImages(rows) {
  const listings = Array.isArray(rows) ? rows : [];
  const coverValues = listings.map(firstDisplayablePhoto);
  const storagePaths = [...new Set(coverValues.filter(isTrustedListingImagePath))];
  const signedByPath = new Map();

  if (storagePaths.length) {
    const signedRows = await signListingImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }

  return listings.map((row, index) => {
    const cover = coverValues[index];
    const resolvedCover = cover ? (signedByPath.get(cover) ?? safeLegacyUrl(cover)) : null;
    return {
      ...row,
      ...listingMediaMetadata(row),
      photos: resolvedCover ? [resolvedCover] : [],
    };
  });
}

export async function hydrateListingImages(rows) {
  const listings = Array.isArray(rows) ? rows : [];
  const storagePaths = [...new Set(
    listings.flatMap((row) => listingPhotoValues(row).filter(isTrustedListingImagePath)),
  )];
  const signedByPath = new Map();

  if (storagePaths.length) {
    const signedRows = await signListingImagePaths(storagePaths);
    signedRows.forEach((row, index) => {
      if (row?.signedUrl) signedByPath.set(storagePaths[index], row.signedUrl);
    });
  }

  return listings.map((row) => ({
    ...row,
    ...listingMediaMetadata(row),
    photos: listingPhotoValues(row)
      .map((value) => signedByPath.get(value) ?? safeLegacyUrl(value))
      .filter(Boolean),
  }));
}
