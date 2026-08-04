import { supabase } from '@/lib/supabaseClient';
import { PUBLIC_LISTING_SELECT } from '@/repositories/publicListingsRepository';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

// Contact columns are no longer selectable by `authenticated` either -- see
// migration 0115. Column privileges are not row-scoped, so granting them to
// every signed-in user let any account bulk-read other sellers' details and
// bypass the reveal cap entirely. Owners now read their own values through
// `owner_listing_contacts`, which filters on seller_id = auth.uid() inside the
// database.
//
// The merge happens here rather than in the components, so everything
// downstream still sees `listing.contact_phone` exactly as before.
const OWNER_LISTING_SELECT = PUBLIC_LISTING_SELECT;

/**
 * Attaches the caller's own contact values to owner listing rows.
 * Returns the rows unchanged if the lookup fails -- a missing prefill is a
 * degraded edit form, not a reason to fail the whole listings page.
 *
 * @template {{ id: string }} T
 * @param {T[]} rows
 * @returns {Promise<T[]>}
 */
async function withOwnerContacts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const { data, error } = await supabase.rpc('owner_listing_contacts', {
    p_listing_ids: rows.map((row) => row.id),
  });
  if (error || !Array.isArray(data)) return rows;

  const byListing = new Map(data.map((entry) => [entry.listing_id, entry]));
  return rows.map((row) => {
    const contact = byListing.get(row.id);
    return contact
      ? {
        ...row,
        contact_phone: contact.contact_phone,
        contact_whatsapp: contact.contact_whatsapp,
        contact_email: contact.contact_email,
      }
      : row;
  });
}

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
  return withOwnerContacts(data ?? []);
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
  const [withContacts] = await withOwnerContacts([data]);
  return withContacts;
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
