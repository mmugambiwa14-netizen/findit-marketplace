import { supabase } from '@/lib/supabaseClient';

function failure(message, error) {
  const result = new Error(error?.message || message);
  result.cause = error;
  return result;
}

async function functionFailure(message, error) {
  let detail = null;
  try {
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      detail = await response.clone().json();
    }
  } catch {
    detail = null;
  }
  const result = new Error(detail?.message || message);
  result.code = detail?.code || error?.name || 'edge_function_error';
  result.status = error?.context?.status || null;
  result.cause = error;
  return result;
}

export async function insertListingSubmission(request) {
  const { data, error } = await supabase.rpc('create_v1_listing_submission', {
    p_submission_key: request.submissionKey,
    p_listing: request.listing,
    p_detail: request.detail,
    p_media: request.media,
  });
  if (error) throw failure('Unable to submit the listing', error);
  return data;
}

export async function transitionOwnerListing(request) {
  const { data, error } = await supabase.rpc('owner_transition_listing', {
    p_listing_id: request.listingId,
    p_action: request.action,
  });
  if (error) throw failure('Unable to update the listing status', error);
  return data;
}

export async function replaceListingMediaRows(request) {
  const { data, error } = await supabase.rpc('replace_listing_media', {
    p_listing_id: request.listingId,
    p_keep_paths: request.keepPaths,
    p_new_media: request.newMedia,
  });
  if (error) throw failure('Unable to update listing images', error);
  return data;
}

export async function invokeListingImageUpload(file) {
  const body = new FormData();
  body.append('file', file);
  const { data, error } = await supabase.functions.invoke('listing-image-upload', { body });
  if (error) throw await functionFailure('Unable to upload the image', error);
  if (!data?.path || !data?.intentId || !data?.previewUrl) throw new Error('The upload response is incomplete');
  return data;
}

export async function deleteStagedListingImage(path) {
  const { error } = await supabase.storage.from('listing-images').remove([path]);
  if (error) throw failure('Unable to remove the staged image', error);
}

export async function signListingImagePaths(paths, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('listing-images').createSignedUrls(paths, expiresIn);
  if (error) throw failure('Unable to prepare listing images', error);
  return data ?? [];
}
