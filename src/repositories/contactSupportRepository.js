import { supabase } from '@/lib/supabaseClient';

export async function insertSupportRequest(input) {
  const { data, error } = await supabase.rpc('submit_support_request', {
    p_category: input.category,
    p_contact_email: input.contactEmail,
    p_message: input.message,
    p_related_reference: input.relatedReference,
  });

  if (error) {
    const failure = new Error(error.message || 'Unable to send the support request');
    failure.cause = error;
    throw failure;
  }
  return data;
}
