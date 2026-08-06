import { supabase } from '@/lib/supabaseClient';
import { PUBLIC_LISTING_SELECT } from '@/repositories/publicListingsRepository';
import { PUBLIC_SERVICE_SELECT } from '@/repositories/servicesRepository';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';

const PUBLIC_PROFILE_SELECT = `
  id,
  user_id,
  company_name,
  business_type,
  profile_type,
  verified,
  phone,
  email,
  website,
  social_links,
  city,
  address,
  description,
  avatar_url,
  avatar_storage_path,
  created_at,
  updated_at
`;

const OWNER_PROFILE_SELECT = `
  ${PUBLIC_PROFILE_SELECT},
  verification_status
`;

function failure(message, error) {
  const repositoryError = new Error(message);
  repositoryError.cause = error;
  return repositoryError;
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function findOwnerBusinessProfile(ownerId) {
  const { data, error } = await supabase
    .from('business_profiles')
    .select(OWNER_PROFILE_SELECT)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (error) throw failure('Unable to load your business profile', error);
  return data ?? null;
}

export async function insertOwnerBusinessProfile(row) {
  const { data, error } = await supabase
    .from('business_profiles')
    .insert(row)
    .select(OWNER_PROFILE_SELECT)
    .single();

  if (error) throw failure('Unable to create the business profile', error);
  return data;
}

export async function updateOwnerBusinessProfile(ownerId, profileId, updates) {
  const { data, error } = await supabase
    .from('business_profiles')
    .update(updates)
    .eq('user_id', ownerId)
    .eq('id', profileId)
    .select(OWNER_PROFILE_SELECT)
    .single();

  if (error) throw failure('Unable to update the business profile', error);
  return data;
}

export async function findPublicBusinessProfile(profileId) {
  const { data, error } = await supabase
    .from('business_profiles_public')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw failure('Unable to load the business profile', error);
  return data ?? null;
}

export async function findPublicBusinessInventory(request) {
  let query = supabase
    .from('listings')
    .select(PUBLIC_LISTING_SELECT)
    .eq('seller_id', request.ownerId)
    .in('status', ['available', 'under_offer']);

  if (request.dealerOnly) query = query.eq('kind', 'car');
  if (request.query) query = query.ilike('title', `%${escapeLikePattern(request.query)}%`);
  query = applyDescendingCreatedAtCursor(query, request.cursor);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw failure('Unable to load the business inventory', error);
  return data ?? [];
}

export async function findPublicBusinessServices(request) {
  let query = supabase
    .from('services')
    .select(PUBLIC_SERVICE_SELECT)
    .eq('provider_id', request.ownerId)
    .eq('status', 'active')
    .neq('category', 'legal');

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) throw failure('Unable to load the business services', error);
  return data ?? [];
}
