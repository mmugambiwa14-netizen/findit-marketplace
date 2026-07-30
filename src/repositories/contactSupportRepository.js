import { supabase } from '@/lib/supabaseClient';

function supportFailureMessage(error) {
  const message = typeof error?.message === 'string' ? error.message : '';

  if (message === 'invalid support category') return 'Choose a valid support category.';
  if (message === 'a valid contact email is required') return 'Enter a valid contact email.';
  if (message === 'support message must be between 20 and 4000 characters') {
    return 'Enter a message between 20 and 4000 characters.';
  }
  if (message === 'related reference is too long') return 'The related reference is too long.';
  if (message === 'active account required') {
    return 'Your account must be active before you can send this request.';
  }
  if (
    message === 'support request rate limit exceeded; try again later'
    || message === 'daily support request limit exceeded'
  ) {
    return 'Too many support requests were sent. Please try again later.';
  }

  return 'We could not send your support request. Please try again.';
}

export async function insertSupportRequest(input) {
  const { data, error } = await supabase.rpc('submit_support_request', {
    p_category: input.category,
    p_contact_email: input.contactEmail,
    p_message: input.message,
    p_related_reference: input.relatedReference,
  });

  if (error) {
    const failure = new Error(supportFailureMessage(error));
    failure.name = 'SupportRequestError';
    throw failure;
  }
  return data;
}
