import { supabase } from '@/lib/supabaseClient';
import { applyDescendingCreatedAtCursor } from '@/services/keysetPagination';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

const SUPPORTED_KINDS = new Set(['property', 'car', 'machinery']);

const DETAIL_SELECT_BY_KIND = {
  property: 'property_details!inner(property_type, bedrooms, bathrooms, size_sqm)',
  car: 'car_details!inner(brand, model, year, mileage, fuel_type, transmission, condition)',
  machinery: 'machinery_details!inner(machinery_type, brand, model, condition, year, usage_hours)',
};

// Keep this projection explicit. It is the public marketplace contract, not
// an unrestricted `select *`, and prevents future private columns from being
// exposed accidentally when the listings table evolves.
//
// Seller contact values are deliberately absent. `anon` has no column grant on
// contact_phone / contact_whatsapp / contact_email, so requesting them here
// would fail the whole query for logged-out visitors. Cards only need to know
// whether a channel exists; the values come from the reveal_listing_contact
// RPC once the viewer is authenticated. See migration 0109.
export const PUBLIC_LISTING_SELECT = `
  id,
  kind,
  seller_id,
  seller_name,
  attributes,
  has_contact_phone,
  has_contact_whatsapp,
  has_contact_email,
  title,
  description,
  price,
  currency,
  deposit,
  agent_fee,
  additional_fees,
  accepts_offers,
  variants,
  photos,
  latitude:public_latitude,
  longitude:public_longitude,
  public_location_label,
  category,
  listing_type,
  status,
  expires_at,
  created_via,
  views,
  created_at,
  updated_at,
  location:locations!listings_location_id_fkey(id, name, type),
  car_details(brand, model, year, mileage, fuel_type, transmission, condition),
  property_details(property_type, bedrooms, bathrooms, size_sqm),
  machinery_details(machinery_type, brand, model, condition, year, usage_hours)
`;

function assertKind(kind) {
  if (!SUPPORTED_KINDS.has(kind)) {
    throw new TypeError(`Unsupported listing kind: ${kind}`);
  }
}

/**
 * Returns the newest public, enquiry-eligible rows for one marketplace category.
 * RLS remains the final visibility boundary; the explicit status predicate is
 * also required so authenticated owners do not see their drafts on Home.
 */
export async function findLatestAvailableListings(kind, limit) {
  assertKind(kind);

  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_LISTING_SELECT)
    .eq('kind', kind)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .in('status', ['available', 'under_offer'])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    const repositoryError = new Error(`Unable to load ${kind} listings`);
    repositoryError.cause = error;
    throw repositoryError;
  }

  return data ?? [];
}

export async function findSavedListingsByIds(listingIds) {
  if (!listingIds.length) return [];
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_LISTING_SELECT)
    .in('id', listingIds);

  if (error) {
    const repositoryError = new Error('Unable to load Favourite listings');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function findPublicListingsByIds(listingIds, signal) {
  if (!listingIds.length) return [];
  let query = supabase
    .from('listings')
    .select(PUBLIC_LISTING_SELECT)
    .in('id', listingIds)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .in('status', ['available', 'under_offer']);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) {
    const repositoryError = new Error('Unable to load recommended listings');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

const SEARCH_SORTS = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'native_price', ascending: true },
  price_desc: { column: 'native_price', ascending: false },
  most_viewed: { column: 'views', ascending: false },
};

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

// Retained only for rollback-compatible older clients. The active Search page
// uses findPublicListingsPage and never requests this exact-count offset path.
export async function findPublicListings(request) {
  assertKind(request.kind);
  const detailSelect = DETAIL_SELECT_BY_KIND[request.kind];
  const sort = SEARCH_SORTS[request.sort];
  const from = (request.page - 1) * request.pageSize;
  const to = from + request.pageSize - 1;
  let query = supabase
    .from('listings')
    .select(`id, kind, seller_id, seller_name, title, description, price, currency, native_price, native_currency, photos, category, listing_type, status, views, created_at, updated_at, location:locations!listings_location_id_fkey(id, name, type), ${detailSelect}`, { count: 'exact' })
    .eq('kind', request.kind)
    .eq('country_code', request.countryCode)
    .in('status', ['available', 'under_offer']);

  if (request.currency) {
    query = query.eq('native_currency', request.currency);
    if (request.minPrice !== null) query = query.gte('native_price', request.minPrice);
    if (request.maxPrice !== null) query = query.lte('native_price', request.maxPrice);
  }
  if (request.query) query = query.ilike('title', `%${escapeLikePattern(request.query)}%`);

  const { data, error, count } = await query
    .order(sort.column, { ascending: sort.ascending })
    .order('id', { ascending: sort.ascending })
    .range(from, to);
  if (error) throw Object.assign(new Error('Unable to search public listings'), { cause: error });
  return { rows: data ?? [], count: count ?? 0 };
}

/**
 * Reads one bounded public Search card page through the currency-safe,
 * privacy-safe thin projection. The full public_listing_search_page_v2 RPC
 * remains installed for compatibility and targeted rollback, but is not used
 * by the active Search card path. The database returns limit+1 rows so the
 * service can derive the next cursor without exact counts or deep offsets.
 */
export async function findPublicListingsPage(request, signal) {
  assertKind(request.kind);
  let query = supabase.rpc('public_listing_search_card_page_v1', {
    p_kind: request.kind,
    p_country_code: request.countryCode,
    p_currency: request.currency,
    p_query: request.query,
    p_category: request.category,
    p_location_id: request.locationId,
    p_min_price: request.minPrice,
    p_max_price: request.maxPrice,
    p_min_bedrooms: request.minBedrooms,
    p_brand: request.brand,
    p_condition: request.condition,
    p_fuel_type: request.fuelType,
    p_transmission: request.transmission,
    p_sort: request.sort,
    p_cursor_value: request.cursor?.value ?? null,
    p_cursor_id: request.cursor?.id ?? null,
    p_limit: request.pageSize,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) {
    const repositoryError = new Error('Unable to search public listings');
    repositoryError.cause = error;
    throw repositoryError;
  }

  return data ?? [];
}

export async function findPublicListingTitleSuggestions(kind, searchTerm, limit = 5, signal = null) {
  assertKind(kind);
  let query = supabase
    .from('listings')
    .select('id, title')
    .eq('kind', kind)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .in('status', ['available', 'under_offer'])
    .ilike('title', `%${escapeLikePattern(searchTerm)}%`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) {
    const repositoryError = new Error('Unable to load listing suggestions');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}

export async function findPublicListingById(kind, id) {
  assertKind(kind);
  const detailSelect = DETAIL_SELECT_BY_KIND[kind];
  const { data, error } = await supabase
    .from('listings')
    .select(`
      id,
      kind,
      seller_id,
      seller_name,
      attributes,
      has_contact_phone,
      has_contact_whatsapp,
      has_contact_email,
      title,
      description,
      price,
      currency,
      deposit,
      agent_fee,
      additional_fees,
      accepts_offers,
      variants,
      photos,
      latitude:public_latitude,
      longitude:public_longitude,
      public_location_label,
      category,
      listing_type,
      status,
      created_via,
      views,
      created_at,
      updated_at,
      location:locations!listings_location_id_fkey(id, name, type),
      ${detailSelect}
    `)
    .eq('kind', kind)
    .eq('id', id)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .maybeSingle();

  if (error) {
    const repositoryError = new Error(`Unable to load ${kind} listing`);
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? null;
}

export async function findPublicSellerListings(request) {
  let query = supabase
    .from('listings')
    .select(PUBLIC_LISTING_SELECT)
    .eq('seller_id', request.sellerId)
    .eq('country_code', LAUNCH_COUNTRY_CODE)
    .in('status', ['available', 'under_offer']);

  query = applyDescendingCreatedAtCursor(query, request.cursor);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(request.limit + 1);

  if (error) {
    const repositoryError = new Error('Unable to load seller listings');
    repositoryError.cause = error;
    throw repositoryError;
  }
  return data ?? [];
}
