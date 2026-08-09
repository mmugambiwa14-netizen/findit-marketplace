import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

// Provider contact values are deliberately absent -- `anon` holds no column
// grant on them. Cards render availability from the has_contact_* flags and
// the values come from the reveal_service_contact RPC once the viewer is
// authenticated. See migration 0109/0111.
export const PUBLIC_SERVICE_SELECT = `
  id,
  provider_id,
  provider_name,
  attributes,
  has_contact_phone,
  has_contact_whatsapp,
  has_contact_email,
  title,
  description,
  category,
  subcategory,
  subcategories,
  price,
  currency,
  pricing_type,
  photos,
  location_id,
  location_name,
  country_code,
  location:locations!services_location_id_fkey(latitude, longitude),
  can_travel,
  delivery_mode,
  service_radius_km,
  remote_available,
  fixed_premises,
  status,
  views,
  created_at,
  updated_at
`;

// Contact columns are no longer selectable by `authenticated` -- see migration
// 0115. Column privileges are not row-scoped, so the grant let any signed-in
// account bulk-read other providers' details and bypass the reveal cap.
// Providers read their own values through `owner_service_contacts`, which
// filters on provider_id = auth.uid() inside the database.
//
// Merging here keeps `service.contact_phone` working for every consumer.
export const OWNER_SERVICE_SELECT = PUBLIC_SERVICE_SELECT;

/**
 * Attaches the caller's own contact values to owner service rows. Returns the
 * rows unchanged on failure: a missing prefill is a degraded edit form, not a
 * reason to fail the page.
 *
 * @template {{ id: string }} T
 * @param {T[]} rows
 * @returns {Promise<T[]>}
 */
async function withOwnerContacts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const { data, error } = await supabase.rpc('owner_service_contacts', {
    p_service_ids: rows.map((row) => row.id),
  });
  if (error || !Array.isArray(data)) return rows;

  const byService = new Map(data.map((entry) => [entry.service_id, entry]));
  return rows.map((row) => {
    const contact = byService.get(row.id);
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

function toRepositoryError(message, error) {
  const failure = new Error(message);
  failure.cause = error;
  return failure;
}

export async function findPublicServices(request) {
  let query = supabase
    .from('services')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .eq('status', 'active')
    .neq('category', 'legal');

  if (request.category !== 'all') query = query.eq('category', request.category);
  if (request.locationId) query = query.eq('location_id', request.locationId);
  if (request.query) {
    const pattern = `%${request.query}%`;
    query = query.or([
      `title.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `provider_name.ilike.${pattern}`,
      `location_name.ilike.${pattern}`,
    ].join(','));
  }

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw toRepositoryError('Unable to load services', error);
  return data ?? [];
}

export async function findPublicServiceById(id) {
  const { data, error } = await supabase
    .from('services')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('id', id)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .eq('status', 'active')
    .neq('category', 'legal')
    .maybeSingle();

  if (error) throw toRepositoryError('Unable to load the service', error);
  return data ?? null;
}

/**
 * @param {string[]} ids
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function findPublicServicesByIds(ids, { signal } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { data, error } = await supabase
    .from('services')
    .select(PUBLIC_SERVICE_SELECT)
    .in('id', ids)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .eq('status', 'active')
    .neq('category', 'legal')
    .limit(24)
    .abortSignal(signal);

  if (error) throw toRepositoryError('Unable to load recommended services', error);
  return data ?? [];
}

export async function findOwnerServices(request) {
  let query = supabase
    .from('services')
    .select(OWNER_SERVICE_SELECT)
    .eq('provider_id', request.providerId)
    .neq('category', 'legal');
  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);
  if (error) throw toRepositoryError('Unable to load your services', error);
  return withOwnerContacts(data ?? []);
}

export async function insertOwnerService(input) {
  const { data, error } = await supabase
    .from('services')
    .insert(input)
    .select(OWNER_SERVICE_SELECT)
    .single();
  if (error) throw toRepositoryError('Unable to create the service', error);
  const [withContacts] = await withOwnerContacts([data]);
  return withContacts;
}

export async function updateOwnerServiceRow(providerId, id, input) {
  const { data, error } = await supabase
    .from('services')
    .update(input)
    .eq('provider_id', providerId)
    .eq('id', id)
    .select(OWNER_SERVICE_SELECT)
    .single();
  if (error) throw toRepositoryError('Unable to update the service', error);
  const [withContacts] = await withOwnerContacts([data]);
  return withContacts;
}

export async function deleteOwnerServiceRow(providerId, id) {
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('provider_id', providerId)
    .eq('id', id)
    .select(OWNER_SERVICE_SELECT)
    .single();
  if (error) throw toRepositoryError('Unable to delete the service', error);
  const [withContacts] = await withOwnerContacts([data]);
  return withContacts;
}
