import { supabase } from '@/lib/supabaseClient';

function adminTaxonomyError(message, error) {
  const failure = new Error(message);
  failure.name = 'TaxonomyAdminOperationError';
  failure.code = error?.code || 'TAXONOMY_ADMIN_FAILED';
  failure.cause = error;
  return failure;
}

async function rpc(name, parameters, message) {
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw adminTaxonomyError(message, error);
  return data;
}

export function fetchAdminTaxonomyRows() {
  return rpc('admin_taxonomy_rows_v2', {}, 'We could not load the taxonomy registry.');
}

export function insertAdminTaxonomyNode(input) {
  return rpc('admin_add_taxonomy_node_v2', {
    p_parent_id: input.parentId,
    p_slug: input.stableSlug,
    p_canonical_slug: input.canonicalSlug,
    p_display_label: input.displayLabel,
    p_description: input.description || null,
    p_node_type: input.nodeType,
    p_is_postable: input.isPostable,
    p_sort_order: input.sortOrder,
    p_schema_binding: input.schemaBinding,
    p_aliases: input.aliases,
    p_synonyms: input.synonyms,
    p_localized_labels: input.localizedLabels,
    p_market_availability: input.marketAvailability,
    p_reason: input.reason,
  }, 'The taxonomy node could not be created.');
}

export function mutateAdminTaxonomyNode(input) {
  return rpc('admin_update_taxonomy_node_v2', {
    p_category_id: input.categoryId,
    p_canonical_slug: input.canonicalSlug,
    p_display_label: input.displayLabel,
    p_description: input.description || null,
    p_sort_order: input.sortOrder,
    p_is_active: input.isActive,
    p_is_postable: input.isPostable,
    p_aliases: input.aliases,
    p_synonyms: input.synonyms,
    p_localized_labels: input.localizedLabels,
    p_market_availability: input.marketAvailability,
    p_superseded_by: input.supersededBy,
    p_valid_to: input.validTo,
    p_schema_binding: input.schemaBinding,
    p_reason: input.reason,
  }, 'The taxonomy node could not be updated.');
}
