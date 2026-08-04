import { supabase } from '@/lib/supabaseClient';

function failure(message, error) {
  const result = new Error(error?.message || message);
  result.cause = error;
  return result;
}

export async function invokeTourUploadIntent(request) {
  const { data, error } = await supabase.functions.invoke('tour-upload-intent', {
    body: {
      parentType: request.parentType,
      parentId: request.parentId,
      peekKind: request.peekKind || 'main',
      filename: request.filename,
      mimeType: request.mimeType,
      byteSize: request.byteSize,
      durationSeconds: request.durationSeconds,
      sha256: request.sha256,
      idempotencyKey: request.idempotencyKey,
    },
  });
  if (error) throw failure('Unable to prepare the Peek upload', error);
  if (!data?.intentId || !data?.tourId || !data?.path || !data?.uploadToken) {
    throw new Error('The Peek upload response is incomplete');
  }
  return data;
}

export async function uploadTourSourceObject({ path, uploadToken, file }) {
  const { data, error } = await supabase.storage
    .from('tour-sources')
    .uploadToSignedUrl(path, uploadToken, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw failure('Unable to upload the Peek video', error);
  return data;
}

export async function invokeTourUploadComplete(intentId) {
  const { data, error } = await supabase.functions.invoke('tour-upload-complete', {
    body: { intentId },
  });
  if (error) throw failure('Unable to confirm the Peek upload', error);
  if (!data?.tourId) throw new Error('The Peek completion response is incomplete');
  return data;
}

export async function readPublicTourSummaries({ listingIds = [], serviceIds = [] } = {}) {
  if (!listingIds.length && !serviceIds.length) return [];
  const { data, error } = await supabase.rpc('public_tour_summaries', {
    p_listing_ids: listingIds,
    p_service_ids: serviceIds,
  });
  if (error) throw failure('Unable to read Peek summaries', error);
  return data ?? [];
}

export async function invokePublicTourFeed(request) {
  const { data, error } = await supabase.functions.invoke('tour-feed', {
    body: request,
  });
  if (error) throw failure('Unable to load Peeks', error);
  if (!data || !Array.isArray(data.items)) throw new Error('The Peek feed response is incomplete');
  return data;
}

export async function invokePublicTourPlayback(parent) {
  const { data, error } = await supabase.functions.invoke('tour-playback-access', {
    body: parent,
  });
  if (error) throw failure('Unable to prepare Peek playback', error);
  return data;
}

export async function readOwnerTourRows(parent) {
  let query = supabase
    .from('listing_tours')
    .select(`
      id, owner_id, listing_id, service_id, peek_kind, status, moderation_status,
      duration_seconds, width, height, source_byte_size, processed_byte_size,
      failure_code, failure_message, rejection_reason, created_at, uploaded_at,
      processing_started_at, ready_at, approved_at, published_at, removed_at
    `)
    .order('created_at', { ascending: false });
  query = parent.parentType === 'listing'
    ? query.eq('listing_id', parent.parentId)
    : query.eq('service_id', parent.parentId);
  const { data, error } = await query;
  if (error) throw failure('Unable to read Peek status', error);
  return data ?? [];
}

export async function removeOwnerTourRow(tourId) {
  const { data, error } = await supabase.rpc('owner_remove_tour', { p_tour_id: tourId });
  if (error) throw failure('Unable to remove the Peek', error);
  return data;
}

export async function retryOwnerTourRow(tourId) {
  const { data, error } = await supabase.rpc('owner_retry_failed_tour', { p_tour_id: tourId });
  if (error) throw failure('Unable to retry the Peek', error);
  return data;
}

export async function reportTourRow(request) {
  const { data, error } = await supabase.rpc('report_tour', {
    p_tour_id: request.tourId,
    p_reason: request.reason,
    p_description: request.description,
  });
  if (error) throw failure('Unable to report the Peek', error);
  return data;
}

export async function readAdminTourQueue(filters = {}) {
  const { data, error } = await supabase.rpc('admin_tour_queue_page', {
    p_query: filters.query ?? '',
    p_status: filters.status ?? 'pending',
    p_limit: filters.limit ?? 25,
    p_cursor_reported_priority: filters.cursor?.reportedPriority ?? null,
    p_cursor_failed_priority: filters.cursor?.failedPriority ?? null,
    p_cursor_at: filters.cursor?.at ?? null,
    p_cursor_id: filters.cursor?.id ?? null,
  });
  if (error) throw failure('Unable to read the Peek moderation queue', error);
  return data ?? [];
}

export async function invokeAdminTourReviewAccess(tourId) {
  const { data, error } = await supabase.functions.invoke('tour-admin-review-access', {
    body: { tourId },
  });
  if (error) throw failure('Unable to prepare Peek review media', error);
  if (!data?.tourId) throw new Error('The Peek review response is incomplete');
  return data;
}

export async function approveAdminTour(tourId, reason) {
  const { data, error } = await supabase.rpc('admin_approve_tour', {
    p_tour_id: tourId,
    p_reason: reason,
  });
  if (error) throw failure('Unable to approve the Peek', error);
  return data;
}

export async function rejectAdminTour(tourId, reason) {
  const { data, error } = await supabase.rpc('admin_reject_tour', {
    p_tour_id: tourId,
    p_reason: reason,
  });
  if (error) throw failure('Unable to reject the Peek', error);
  return data;
}
