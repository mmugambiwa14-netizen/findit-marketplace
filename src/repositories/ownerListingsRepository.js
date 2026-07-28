import { supabase } from '@/lib/supabaseClient';
import { PUBLIC_LISTING_SELECT } from '@/repositories/publicListingsRepository';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

const OWNER_LISTING_SELECT = PUBLIC_LISTING_SELECT;

function repositoryFailure(message, error) {
  const failure = new Error(message);
  failure.cause = error;
  return failure;
}

export async function findOwnerListings(request) {
  let query = supabase
    .from('listings')
    .select(OWNER_LISTING_SELECT)
    .eq('seller_id', request.ownerId);

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw repositoryFailure('Unable to load your listings', error);
  return data ?? [];
}

export async function findOwnerListingNotes(listingIds) {
  if (!listingIds.length) return [];
  const { data, error } = await supabase.rpc('owner_listing_notes', {
    p_listing_ids: listingIds,
  });

  if (error) throw repositoryFailure('Unable to load listing review notes', error);
  return data ?? [];
}

export async function countOwnerListingRows(ownerId) {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', ownerId);

  if (error) throw repositoryFailure('Unable to count your listings', error);
  return count ?? 0;
}

export async function updateOwnerListingRow(ownerId, kind, listingId, updates) {
  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId)
    .eq('kind', kind)
    .eq('seller_id', ownerId)
    .select(OWNER_LISTING_SELECT)
    .maybeSingle();

  if (error) throw repositoryFailure('Unable to update the listing', error);
  if (!data) throw new Error('Listing not found or you no longer have access');
  return data;
}

export async function deleteOwnerListingRow(ownerId, kind, listingId) {
  const { data, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('kind', kind)
    .eq('seller_id', ownerId)
    .select('id')
    .maybeSingle();

  if (error) throw repositoryFailure('Unable to delete the listing', error);
  if (!data) throw new Error('Listing not found or you no longer have access');
  return data.id;
}
