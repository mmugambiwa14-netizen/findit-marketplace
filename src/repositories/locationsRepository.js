import { supabase } from '@/lib/supabaseClient';

const LAUNCH_COUNTRY_CODES = ['ZW'];

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function findActiveLocations({ type, parentId = null, limit = 200 }) {
  let query = supabase
    .from('locations')
    .select('id, name, type, parent_id, country_code, latitude, longitude, timezone')
    .eq('type', type)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (type === 'country') {
    query = query.in('country_code', LAUNCH_COUNTRY_CODES);
  }
  if (parentId) query = query.eq('parent_id', parentId);

  const { data, error } = await query;
  if (error) {
    const repositoryError = new Error(`Unable to load ${type} locations`);
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function findActiveLocationSuggestions(searchTerm, limit = 5) {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, type')
    .eq('is_active', true)
    .eq('country_code', 'ZW')
    .in('type', ['city', 'town', 'district'])
    .ilike('name', `%${escapeLikePattern(searchTerm)}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    const repositoryError = new Error('Unable to load location suggestions');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}
