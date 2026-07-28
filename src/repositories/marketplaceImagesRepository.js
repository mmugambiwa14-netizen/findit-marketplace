import { supabase } from '@/lib/supabaseClient';

function failure(message, error) {
  const result = new Error(error?.message || message);
  result.cause = error;
  return result;
}

export async function invokeMarketplaceImageUpload(file, purpose) {
  const body = new FormData();
  body.append('file', file);
  body.append('purpose', purpose);
  const { data, error } = await supabase.functions.invoke('marketplace-image-upload', { body });
  if (error) throw failure('Unable to upload the image', error);
  if (!data?.path || !data?.intentId || !data?.previewUrl || data.purpose !== purpose) {
    throw new Error('The upload response is incomplete');
  }
  return data;
}

export async function attachMarketplaceImageRow(request) {
  const { data, error } = await supabase.rpc('attach_marketplace_image', {
    p_intent_id: request.intentId,
    p_storage_path: request.path,
    p_target_kind: request.targetKind,
    p_target_id: request.targetId,
    p_display_order: request.displayOrder,
  });
  if (error) throw failure('Unable to attach the image', error);
  return data;
}

export async function detachMarketplaceImageRow(request) {
  const { data, error } = await supabase.rpc('detach_marketplace_image', {
    p_target_kind: request.targetKind,
    p_target_id: request.targetId,
    p_storage_path: request.path,
  });
  if (error) throw failure('Unable to remove the image', error);
  return data;
}

export async function replaceServiceMediaRows(request) {
  const { data, error } = await supabase.rpc('replace_service_media', {
    p_service_id: request.targetId,
    p_keep_paths: request.keepPaths,
    p_new_media: request.newMedia,
  });
  if (error) throw failure('Unable to update service images', error);
  return data;
}

export async function deleteMarketplaceImageObjects(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from('marketplace-images').remove(paths);
  if (error) throw failure('Unable to remove stored images', error);
}

export async function signMarketplaceImagePaths(paths, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('marketplace-images').createSignedUrls(paths, expiresIn);
  if (error) throw failure('Unable to prepare marketplace images', error);
  return data ?? [];
}
