import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

export const PUBLIC_SERVICE_SELECT = `
  id,
  provider_id,
  provider_name,
  contact_phone,
  contact_whatsapp,
  contact_email,
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
  can_travel,
  status,
  created_at,
  updated_at
`;

function toRepositoryError(message, error) {
  const failure = new Error(message);
  failure.cause = error;
  return failure;
}

export async function findPublicServices(request) {
  let query = supabase
    .from('services')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('status', 'active')
    .neq('category', 'legal');

  if (request.category !== 'all') query = query.eq('category', request.category);
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
    .select(PUBLIC_SERVICE_SELECT)
    .eq('provider_id', request.providerId)
    .neq('category', 'legal');

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw toRepositoryError('Unable to load your services', error);
  return data ?? [];
}

export async function insertOwnerService(row) {
  const { data, error } = await supabase
    .from('services')
    .insert(row)
    .select(PUBLIC_SERVICE_SELECT)
    .single();

  if (error) throw toRepositoryError('Unable to publish the service', error);
  return data;
}

export async function updateOwnerServiceRow(providerId, id, updates) {
  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('provider_id', providerId)
    .eq('id', id)
    .neq('category', 'legal')
    .select(PUBLIC_SERVICE_SELECT)
    .single();

  if (error) throw toRepositoryError('Unable to update the service', error);
  return data;
}

export async function deleteOwnerServiceRow(providerId, id) {
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('provider_id', providerId)
    .eq('id', id)
    .neq('category', 'legal')
    .select('id,photos')
    .single();

  if (error) throw toRepositoryError('Unable to delete the service', error);
  return data;
}
