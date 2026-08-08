import { fetchCategoryTaxonomy, fetchResolvedCategory } from '@/repositories/taxonomyRepository';

export const MARKETPLACE_KINDS = Object.freeze(['property', 'car', 'machinery', 'service']);
const MARKETPLACE_KIND_SET = new Set(MARKETPLACE_KINDS);

function normalizeKind(value, { optional = false } = {}) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  if (!MARKETPLACE_KIND_SET.has(value)) throw new TypeError('Marketplace category is invalid');
  return value;
}

function textArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
}

export function normalizeTaxonomyNode(row) {
  return Object.freeze({
    id: row.category_id,
    stableSlug: row.stable_slug,
    canonicalSlug: row.canonical_slug,
    parentId: row.parent_id ?? null,
    marketplaceKind: row.marketplace_kind,
    label: row.display_label,
    description: row.description ?? '',
    sortOrder: Number(row.sort_order ?? 0),
    nodeType: row.node_type,
    isPostable: Boolean(row.is_postable),
    aliases: textArray(row.aliases),
    synonyms: textArray(row.synonyms),
    supersededBy: row.superseded_by ?? null,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    schemaBinding: row.schema_binding && typeof row.schema_binding === 'object' ? row.schema_binding : {},
    taxonomyVersion: Number(row.taxonomy_version ?? 1),
    depth: Number(row.depth ?? 0),
    pathSlugs: textArray(row.path_slugs),
    pathLabels: textArray(row.path_labels),
  });
}

export async function getCategoryTaxonomy(marketplaceKind = null) {
  const normalizedKind = normalizeKind(marketplaceKind, { optional: true });
  const rows = await fetchCategoryTaxonomy(normalizedKind);
  return rows.map(normalizeTaxonomyNode);
}

export async function resolveCategory(marketplaceKind, slug) {
  const kind = normalizeKind(marketplaceKind);
  const normalizedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedSlug)) throw new TypeError('Category slug is invalid');
  const row = await fetchResolvedCategory(kind, normalizedSlug);
  if (!row) return null;
  return {
    id: row.category_id,
    stableSlug: row.stable_slug,
    canonicalSlug: row.canonical_slug,
    isPostable: Boolean(row.is_postable),
    supersededBy: row.superseded_by ?? null,
    schemaBinding: row.schema_binding && typeof row.schema_binding === 'object' ? row.schema_binding : {},
  };
}

export function marketplaceRoots(nodes) {
  return nodes
    .filter((node) => node.depth === 0 && node.nodeType === 'group')
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

export function postableNodes(nodes, marketplaceKind) {
  const kind = normalizeKind(marketplaceKind);
  return nodes
    .filter((node) => node.marketplaceKind === kind && node.isPostable && node.nodeType === 'category' && !node.supersededBy)
    .sort((left, right) => {
      const leftPath = left.pathLabels.join(' / ');
      const rightPath = right.pathLabels.join(' / ');
      return leftPath.localeCompare(rightPath) || left.sortOrder - right.sortOrder || left.label.localeCompare(right.label);
    });
}

/**
 * Converts an arbitrary-depth taxonomy into select groups without making tree
 * depth part of the category identity. A direct child of a marketplace root is
 * grouped under "All"; deeper leaves are grouped by their intermediate path.
 */
export function groupPostableNodes(nodes, marketplaceKind) {
  return postableNodes(nodes, marketplaceKind).reduce((groups, node) => {
    const intermediate = node.pathLabels.slice(1, -1);
    const group = intermediate.length ? intermediate.join(' / ') : 'All';
    const option = {
      value: node.stableSlug,
      label: node.label,
      canonicalSlug: node.canonicalSlug,
      schemaBinding: node.schemaBinding,
      pathLabels: node.pathLabels,
    };
    const current = groups.get(group) ?? [];
    current.push(option);
    groups.set(group, current);
    return groups;
  }, new Map());
}
