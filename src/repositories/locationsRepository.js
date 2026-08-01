import { supabase } from '@/lib/supabaseClient';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function findActiveLocations({
  type,
  parentId = null,
  countryCode = type === 'country' ? null : LAUNCH_COUNTRY_CODE,
  limit = type === 'country' ? 100 : 250,
}) {
  let query = supabase
    .from('locations')
    .select('id, name, type, parent_id, country_code, latitude, longitude, timezone')
    .eq('type', type)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (countryCode) query = query.eq('country_code', countryCode);
  if (parentId) query = query.eq('parent_id', parentId);

  const { data, error } = await query;
  if (error) {
    const repositoryError = new Error(`Unable to load ${type} locations`);
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function searchActiveMarketplacePlaces({ parentId, searchTerm = '', limit = 30 }) {
  const { data, error } = await supabase.rpc('search_marketplace_places', {
    p_parent_id: parentId,
    p_query: searchTerm,
    p_limit: limit,
  });
  if (error) {
    const repositoryError = new Error('Unable to search marketplace places');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function findMarketplaceLocationHierarchy(locationId) {
  const { data, error } = await supabase.rpc('get_marketplace_location_hierarchy', {
    p_location_id: locationId,
  });
  if (error) {
    const repositoryError = new Error('Unable to load the location hierarchy');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data?.[0] ?? null;
}

export async function resolveNearestMarketplacePlace({ latitude, longitude }) {
  const { data, error } = await supabase.rpc('resolve_marketplace_location', {
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) {
    const repositoryError = new Error('Unable to match the device location');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data?.[0] ?? null;
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
