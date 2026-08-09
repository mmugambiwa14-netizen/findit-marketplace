import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

function repositoryError(message, error) {
  const failure = new Error(message);
  failure.cause = error;
  return failure;
}

export async function findServiceFavourite(userId, serviceId) {
  const { data, error } = await supabase
    .from('saved_services')
    .select('id, user_id, service_id, created_at')
    .eq('user_id', userId)
    .eq('service_id', serviceId)
    .maybeSingle();

  if (error) throw repositoryError('Unable to read saved service state', error);
  return data ?? null;
}

export async function findServiceFavouriteIds(userId, serviceIds) {
  if (!serviceIds.length) return [];
  const { data, error } = await supabase
    .from('saved_services')
    .select('service_id')
    .eq('user_id', userId)
    .in('service_id', serviceIds);

  if (error) throw repositoryError('Unable to load saved services', error);
  return (data ?? []).map((row) => row.service_id);
}

export async function findServiceFavouriteRows(request) {
  let query = supabase
    .from('saved_services')
    .select('id, user_id, service_id, created_at')
    .eq('user_id', request.userId);

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw repositoryError('Unable to load saved services', error);
  return data ?? [];
}

export async function insertServiceFavourite(userId, serviceId) {
  const { data, error } = await supabase
    .from('saved_services')
    .upsert({ user_id: userId, service_id: serviceId }, {
      onConflict: 'user_id,service_id',
      ignoreDuplicates: false,
    })
    .select('id, user_id, service_id, created_at')
    .single();

  if (error) throw repositoryError('Unable to save service', error);
  return data;
}

export async function deleteServiceFavourite(userId, serviceId) {
  const { error } = await supabase
    .from('saved_services')
    .delete()
    .eq('user_id', userId)
    .eq('service_id', serviceId);

  if (error) throw repositoryError('Unable to remove saved service', error);
}
