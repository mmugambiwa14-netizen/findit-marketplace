import { supabase } from '@/lib/supabaseClient';

/**
 * @returns {Promise<{
 *   id: string,
 *   full_name: string | null,
 *   bio: string | null,
 *   avatar_url: string | null
 * } | null>}
 */
export async function findPublicSellerProfile(sellerId) {
  const { data, error } = await supabase
    .rpc('get_public_seller_profile', { p_seller_id: sellerId });

  if (error) {
    const failure = new Error('Unable to load the seller profile');
    failure.cause = error;
    throw failure;
  }
  const profile = /** @type {{
    id: string,
    full_name: string | null,
    bio: string | null,
    avatar_url: string | null
  } | null} */ (data);
  return profile ?? null;
}
