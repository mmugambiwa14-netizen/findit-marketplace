import {
  fetchAdminTaxonomyRows,
  insertAdminTaxonomyNode,
  mutateAdminTaxonomyNode,
} from '@/repositories/taxonomyAdminRepository';
import {
  normalizeTaxonomyNodeCreate,
  normalizeTaxonomyNodeUpdate,
} from '@/services/taxonomyAdminContracts';

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function getAdminTaxonomy() {
  const rows = await fetchAdminTaxonomyRows();
  return array(rows).map((row) => ({
    id: row.category_id,
    stableSlug: row.stable_slug,
    canonicalSlug: row.canonical_slug,
    parentId: row.parent_id ?? null,
    parentSlug: row.parent_slug ?? null,
    marketplaceKind: row.marketplace_kind,
    displayLabel: row.display_label,
    localizedLabels: object(row.localized_labels),
    description: row.description ?? '',
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    isProtected: Boolean(row.is_protected),
    nodeType: row.node_type,
    isPostable: Boolean(row.is_postable),
    aliases: array(row.aliases),
    synonyms: array(row.synonyms),
    marketAvailability: array(row.market_availability),
    supersededBy: row.superseded_by ?? null,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    schemaBinding: object(row.schema_binding),
    taxonomyVersion: Number(row.taxonomy_version ?? 1),
    depth: Number(row.depth ?? 0),
    pathLabels: array(row.path_labels),
    directListingCount: Number(row.direct_listing_count ?? 0),
    descendantListingCount: Number(row.descendant_listing_count ?? 0),
  }));
}

export function addAdminTaxonomyNode(input) {
  return insertAdminTaxonomyNode(normalizeTaxonomyNodeCreate(input));
}

export function updateAdminTaxonomyNode(input) {
  return mutateAdminTaxonomyNode(normalizeTaxonomyNodeUpdate(input));
}
