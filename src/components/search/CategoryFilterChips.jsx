import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, HardHat, Home, LayoutGrid, Wrench } from 'lucide-react';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { getCategoryTaxonomy } from '@/services/taxonomyService';

const TYPE_ICON = Object.freeze({
  property: Home,
  car: Car,
  machinery: HardHat,
  service: Wrench,
});
const SUPPORTED_TYPES = new Set(Object.keys(TYPE_ICON));

function browseChipOrder(node) {
  const value = Number(node.schemaBinding?.ui?.browse_chip_order);
  return Number.isFinite(value) ? value : null;
}

function isEligibleBrowseChip(node, type) {
  const order = browseChipOrder(node);
  if (order === null || node.marketplaceKind !== type || node.supersededBy) return false;
  if (type === 'service') {
    return node.nodeType === 'group'
      && node.schemaBinding?.defaults?.service_domain === node.stableSlug;
  }
  return node.nodeType === 'category' && node.isPostable;
}

export default function CategoryFilterChips({
  type,
  category,
  onSelect,
  countryCode = LAUNCH_COUNTRY_CODE,
}) {
  const normalizedCountry = String(countryCode || LAUNCH_COUNTRY_CODE).toUpperCase();
  const supported = SUPPORTED_TYPES.has(type);
  const taxonomyQuery = useQuery({
    queryKey: ['public-category-taxonomy', 'browse-chips', type, normalizedCountry],
    queryFn: () => getCategoryTaxonomy(type, normalizedCountry),
    enabled: supported,
    staleTime: 5 * 60 * 1000,
  });

  const chips = useMemo(() => {
    if (!supported) return [];
    const Icon = TYPE_ICON[type];
    const taxonomyChips = (taxonomyQuery.data || [])
      .filter((node) => isEligibleBrowseChip(node, type))
      .sort((left, right) => (
        browseChipOrder(left) - browseChipOrder(right)
        || left.label.localeCompare(right.label)
      ))
      .map((node) => ({
        value: node.stableSlug,
        label: node.label,
        icon: Icon,
      }));
    return [
      { value: '', label: type === 'service' ? 'All services' : 'All', icon: LayoutGrid },
      ...taxonomyChips,
    ];
  }, [supported, taxonomyQuery.data, type]);

  if (!chips.length) return null;

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-3" aria-busy={taxonomyQuery.isLoading || undefined}>
      {chips.map(({ value, label, icon: Icon }) => {
        const active = (category || '') === value;
        return (
          <button
            type="button"
            key={value || 'all'}
            onClick={() => onSelect(value)}
            disabled={value !== '' && taxonomyQuery.isError}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
