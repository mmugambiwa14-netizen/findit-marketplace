import { supabase } from '@/lib/supabaseClient';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function findActiveLocations({ type, parentId = null, countryCode = LAUNCH_COUNTRY_CODE, limit = 200 }) {
  let query = supabase
    .from('locations')
    .select('id, name, type, parent_id, country_code, latitude, longitude, timezone')
    .eq('type', type)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (type === 'country') {
    query = query.eq('country_code', countryCode);
  } else if (countryCode) {
    query = query.eq('country_code', countryCode);
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

export async function findActiveLocationSuggestions(searchTerm, { countryCode = LAUNCH_COUNTRY_CODE, limit = 5 } = {}) {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, type')
    .eq('is_active', true)
    .eq('country_code', countryCode)
    .in('type', ['region', 'state', 'province', 'county', 'city', 'town', 'district', 'suburb', 'neighbourhood', 'village'])
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
