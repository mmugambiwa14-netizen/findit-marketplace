import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

export async function findFavourite(userId, listingId) {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('id, user_id, listing_id, created_at')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (error) {
    const repositoryError = new Error('Unable to read Favourite state');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? null;
}

export async function findFavouriteListingIds(userId, listingIds) {
  if (!listingIds.length) return [];
  const { data, error } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', listingIds);

  if (error) {
    const repositoryError = new Error('Unable to load Favourites');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return (data ?? []).map((row) => row.listing_id);
}

export async function findFavouriteRows(request) {
  let query = supabase
    .from('saved_listings')
    .select('id, user_id, listing_id, created_at')
    .eq('user_id', request.userId);

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) {
    const repositoryError = new Error('Unable to load Favourites');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function insertFavourite(userId, listingId) {
  const { data, error } = await supabase
    .from('saved_listings')
    .upsert({ user_id: userId, listing_id: listingId }, {
      onConflict: 'user_id,listing_id',
      ignoreDuplicates: false,
    })
    .select('id, user_id, listing_id, created_at')
    .single();

  if (error) {
    const repositoryError = new Error('Unable to add Favourite');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data;
}

export async function deleteFavourite(userId, listingId) {
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);

  if (error) {
    const repositoryError = new Error('Unable to remove Favourite');
    repositoryError.cause = error;
    throw repositoryError;
  }
}
