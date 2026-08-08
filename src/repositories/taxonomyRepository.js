import { supabase } from '@/lib/supabaseClient';

function taxonomyError(message, error) {
  const failure = new Error(message);
  failure.name = 'TaxonomyRepositoryError';
  failure.code = error?.code || 'TAXONOMY_READ_FAILED';
  failure.cause = error;
  return failure;
}

export async function fetchCategoryTaxonomy(marketplaceKind = null, countryCode = null) {
  const { data, error } = await supabase.rpc('public_category_taxonomy_v2', {
    p_marketplace_kind: marketplaceKind,
    p_country_code: countryCode,
  });
  if (error) throw taxonomyError('We could not load the marketplace categories.', error);
  return data ?? [];
}

export async function fetchResolvedCategory(marketplaceKind, slug, countryCode = null) {
  const { data, error } = await supabase.rpc('resolve_category_taxonomy', {
    p_marketplace_kind: marketplaceKind,
    p_slug: slug,
    p_country_code: countryCode,
  });
  if (error) throw taxonomyError('We could not resolve this marketplace category.', error);
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}
