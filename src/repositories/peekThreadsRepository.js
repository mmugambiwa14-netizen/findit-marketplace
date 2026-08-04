import { supabase } from '@/lib/supabaseClient';

async function invoke(name, args, message) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const repositoryError = new Error(message);
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data;
}

export async function readPeekThreadPage(request) {
  const isListing = request.parentType === 'listing';
  const data = await invoke('peek_thread_page', {
    p_listing_id: isListing ? request.parentId : null,
    p_service_id: isListing ? null : request.parentId,
    p_filter: request.filter,
    p_sort: request.sort,
    p_cursor_supporter_count: request.cursor?.supporterCount ?? null,
    p_cursor_created_at: request.cursor?.createdAt ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  }, 'Unable to load Peek requests');
  return data ?? [];
}

export async function readSellerPeekRequestQueue(request) {
  const data = await invoke('seller_peek_request_queue', {
    p_cursor_score: request.cursor?.score ?? null,
    p_cursor_created_at: request.cursor?.createdAt ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  }, 'Unable to load Buyer Peek Requests');
  return data ?? [];
}

export async function invokeResponsePeekPlayback(tourId) {
  const { data, error } = await supabase.functions.invoke('tour-playback-access', {
    body: { tourId },
  });
  if (error) {
    const repositoryError = new Error('Unable to prepare Response Peek playback');
    repositoryError.cause = error;
    throw repositoryError;
  }
  if (!data?.tourId || !data?.playbackUrl) throw new Error('Response Peek playback is incomplete');
  return data;
}

export function createPeekRequestRow(args) {
  return invoke('create_peek_request', args, 'Unable to create the Peek Request');
}

export function supportPeekRequestRow(requestId) {
  return invoke('support_peek_request', { p_request_id: requestId }, 'Unable to support this Peek Request');
}

export function withdrawPeekRequestSupportRow(requestId) {
  return invoke('withdraw_peek_request_support', { p_request_id: requestId }, 'Unable to withdraw support');
}

export function declinePeekRequestRow(args) {
  return invoke('decline_peek_request', args, 'Unable to decline the Peek Request');
}

export function mergePeekRequestRows(args) {
  return invoke('merge_peek_request', args, 'Unable to merge the Peek Requests');
}

export function bindResponsePeekRows(args) {
  return invoke('bind_response_peek', args, 'Unable to attach the Response Peek');
}
