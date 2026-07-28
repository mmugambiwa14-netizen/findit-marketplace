import { supabase } from '@/lib/supabaseClient';

export async function updateOwnProfileRow(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id,email,full_name,phone,phone_verified,bio,avatar_url,role,status,ban_reason,ban_until')
    .maybeSingle();

  if (error) {
    const failure = new Error('Unable to update your profile');
    failure.cause = error;
    throw failure;
  }
  if (!data) throw new Error('Profile not found or you no longer have access');
  return data;
}
