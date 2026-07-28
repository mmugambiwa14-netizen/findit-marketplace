import {
  deleteOwnerListingRow,
  countOwnerListingRows,
  findOwnerListingNotes,
  findOwnerListings,
  updateOwnerListingRow,
} from '@/repositories/ownerListingsRepository';
import { mapPublicListing } from '@/services/listingMappers';
import { hydrateListingImages, removeStagedListingImage, replaceListingMedia } from '@/services/listingCreationService';
import {
  normalizeOwnerListingIdentity,
  normalizeOwnerListingLimit,
  normalizeOwnerListingsPageRequest,
  normalizeOwnerListingUpdate,
  normalizeOwnerId,
} from '@/services/ownerListingContracts';
import { createKeysetPage } from '@/services/keysetPagination';

export async function getOwnerListingsPage(ownerId, input = {}) {
  const request = normalizeOwnerListingsPageRequest(ownerId, input);
  const page = createKeysetPage(await findOwnerListings(request), request.limit);
  const notes = await findOwnerListingNotes(page.items.map((listing) => listing.id));
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const ownerRows = page.items.map((listing) => ({
    ...listing,
    ...notesById.get(listing.id),
  }));
  return {
    items: (await hydrateListingImages(ownerRows)).map(mapPublicListing),
    nextCursor: page.nextCursor,
  };
}

export async function getOwnerListings(ownerId, limit = 30) {
  normalizeOwnerListingLimit(Math.min(Number(limit) || 30, 200));
  return (await getOwnerListingsPage(ownerId, { limit })).items;
}

export async function getOwnerListingsCount(ownerId) {
  return countOwnerListingRows(normalizeOwnerId(ownerId));
}

export async function updateOwnerListing(ownerId, kind, listingId, input, mediaChange = null) {
  const identity = normalizeOwnerListingIdentity(ownerId, kind, listingId);
  const row = await updateOwnerListingRow(
    identity.ownerId,
    identity.kind,
    identity.listingId,
    normalizeOwnerListingUpdate(input),
  );
  if (!mediaChange) return mapPublicListing((await hydrateListingImages([row]))[0]);

  const uploads = Array.isArray(mediaChange.uploads) ? mediaChange.uploads : [];
  try {
    const replacement = await replaceListingMedia(
      identity.listingId,
      mediaChange.keepPaths,
      uploads,
    );
    const removedPaths = Array.isArray(replacement?.removedPaths) ? replacement.removedPaths : [];
    await Promise.allSettled(removedPaths.map((path) => removeStagedListingImage(path)));
    return mapPublicListing((await hydrateListingImages([{
      ...row,
      photos: replacement?.photos ?? [],
      status: replacement?.status ?? row.status,
    }]))[0]);
  } catch (error) {
    await Promise.allSettled(uploads.map((upload) => removeStagedListingImage(upload.path)));
    throw Object.assign(
      new Error('Listing details were saved, but image changes could not be applied. Reload and try the images again.'),
      { cause: error, partial: true },
    );
  }
}

export async function deleteOwnerListing(ownerId, kind, listingId, photoPaths = []) {
  const identity = normalizeOwnerListingIdentity(ownerId, kind, listingId);
  const deletedId = await deleteOwnerListingRow(identity.ownerId, identity.kind, identity.listingId);
  await Promise.allSettled(photoPaths.map((path) => removeStagedListingImage(path)));
  return deletedId;
}
