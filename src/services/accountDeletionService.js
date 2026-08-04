import { supabase } from '@/lib/supabaseClient';

export async function deleteCurrentAccount(confirmation) {
  const normalized = String(confirmation || '').trim().toUpperCase();
  if (normalized !== 'DELETE') throw new Error('Type DELETE to confirm.');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: normalized },
  });

  if (error) {
    const message = data?.error || error?.context?.body?.error || error.message;
    throw new Error(message || 'We could not delete your account. Please try again.');
  }
  if (!data?.deleted) throw new Error(data?.error || 'We could not delete your account. Please try again.');
  return data;
}
