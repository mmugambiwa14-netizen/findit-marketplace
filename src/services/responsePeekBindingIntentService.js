import { supabase } from '@/lib/supabaseClient';

export async function queueResponsePeekBinding(tourId, requestId) {
  const { data, error } = await supabase.rpc('queue_response_peek_binding', {
    p_tour_id: tourId,
    p_request_id: requestId,
  });
  if (error) {
    const failure = new Error('The Response Peek uploaded, but FindIt could not attach it to the buyer request.');
    failure.cause = error;
    throw failure;
  }
  return Boolean(data);
}
