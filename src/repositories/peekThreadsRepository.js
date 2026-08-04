import { supabase } from '@/lib/supabaseClient';

export async function readPeekThreadPage(request) {
  const isListing = request.parentType === 'listing';
  const { data, error } = await supabase.rpc('peek_thread_page', {
    p_listing_id: isListing ? request.parentId : null,
    p_service_id: isListing ? null : request.parentId,
    p_filter: request.filter,
    p_sort: request.sort,
    p_cursor_supporter_count: request.cursor?.supporterCount ?? null,
    p_cursor_created_at: request.cursor?.createdAt ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.limit,
  });

  if (error) {
    const repositoryError = new Error('Unable to load Peek requests');
    repositoryError.cause = error;
    throw repositoryError;
  }

  return data ?? [];
}
