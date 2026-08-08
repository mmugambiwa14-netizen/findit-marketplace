import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PropertyCategoryIcon,
  CarCategoryIcon,
  MachineryCategoryIcon,
  ServicesCategoryIcon,
} from '@/components/discover/CategoryIcons';
import BusinessPublishingGate, { usePublishingAccess } from '@/components/business/BusinessPublishingGate';
import PublishingOperationsPanel from '@/components/business/PublishingOperationsPanel';
import { getCategoryTaxonomy, groupPostableNodes, marketplaceRoots } from '@/services/taxonomyService';
import { seedListingSchemaValues } from '@/services/listingSchemaBinding';
import StepNav from './StepNav';

const FAMILY_PRESENTATION = Object.freeze({
  property: { icon: PropertyCategoryIcon, fallbackLabel: 'Property', desc: 'Homes, land and commercial property' },
  car: { icon: CarCategoryIcon, fallbackLabel: 'Vehicles', desc: 'Passenger, commercial and specialist vehicles' },
  machinery: { icon: MachineryCategoryIcon, fallbackLabel: 'Machinery', desc: 'Heavy equipment, plant and machinery' },
  service: { icon: ServicesCategoryIcon, fallbackLabel: 'Services', desc: 'Repairs, trades and professional services' },
});

export default function Step1Category(props) {
  return <BusinessPublishingGate><ApprovedCategorySelection {...props} /></BusinessPublishingGate>;
}

function ApprovedCategorySelection({ formData, update, onContinue }) {
  const navigate = useNavigate();
  const { access, refresh } = usePublishingAccess();
  const [error, setError] = useState('');
  const marketCountry = String(formData.country_code || LAUNCH_COUNTRY_CODE).toUpperCase();
  const taxonomyQuery = useQuery({
    queryKey: ['public-category-taxonomy', marketCountry],
    queryFn: () => getCategoryTaxonomy(null, marketCountry),
    staleTime: 5 * 60 * 1000,
  });

  const taxonomy = taxonomyQuery.data ?? [];
  const rootsByKind = useMemo(
    () => new Map(marketplaceRoots(taxonomy).map((root) => [root.marketplaceKind, root])),
    [taxonomy],
  );
  const categories = useMemo(() => access.approvedCategories
    .map((kind) => {
      const presentation = FAMILY_PRESENTATION[kind];
      if (!presentation) return null;
      const root = rootsByKind.get(kind);
      if (!root) return null;
      return {
        key: kind,
        icon: presentation.icon,
        label: root.label || presentation.fallbackLabel,
        desc: root.description || presentation.desc,
      };
    })
    .filter(Boolean), [access.approvedCategories, rootsByKind]);

  const selected = categories.find((category) => category.key === formData.listing_category);
  const grouped = useMemo(
    () => selected ? groupPostableNodes(taxonomy, selected.key) : new Map(),
    [selected, taxonomy],
  );
  const postableCount = useMemo(
    () => [...grouped.values()].reduce((count, options) => count + options.length, 0),
    [grouped],
  );
  const optionsByValue = useMemo(() => new Map(
    [...grouped.values()].flat().map((option) => [option.value, option]),
  ), [grouped]);

  const choose = (category) => {
    setError('');
    if (!access.approvedCategories.includes(category.key)) {
      setError('Your business is not approved to publish in this category.');
      return;
    }
    if (category.key === 'service') {
      navigate('/create-service');
      return;
    }
    update('listing_category', category.key);
    update('category', '');
    update('type', category.key);
    update('detail', {});
    update('taxonomy_binding', {});
    update('taxonomy_context', {});
  };

  const chooseTaxonomyCategory = (value) => {
    const option = optionsByValue.get(value);
    if (!option || !selected) {
      setError('That category is no longer available. Refresh the taxonomy and try again.');
      return;
    }
    try {
      const seed = seedListingSchemaValues(selected.key, option.schemaBinding);
      update('category', option.value);
      update('taxonomy_binding', option.schemaBinding);
      update('taxonomy_context', seed.taxonomyDimensions);
      update('detail', seed.values);
      if (seed.offerType) update('listing_type', seed.offerType);
      setError('');
    } catch {
      setError('That category is not compatible with the current listing schema. Refresh and try again.');
    }
  };

  const continueToDetails = () => {
    if (!formData.listing_category) return setError('Select what you are posting.');
    if (!access.approvedCategories.includes(formData.listing_category)) return setError('Your business is not approved for this category.');
    if (formData.listing_category !== 'service' && !formData.category) return setError('Select a category to continue.');
    setError('');
    onContinue();
  };

  if (taxonomyQuery.isLoading) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a listing</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">What are you posting?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Loading the current marketplace categories…</p>
        </div>
        <div className="grid grid-cols-2 gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-[154px] animate-pulse rounded-2xl border bg-muted/35" />)}
        </div>
      </div>
    );
  }

  if (taxonomyQuery.isError) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a listing</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Categories are temporarily unavailable</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">We could not load the current marketplace taxonomy. No fallback list is used, so you cannot accidentally post against stale category rules.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => taxonomyQuery.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Try again
        </Button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a listing</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">No approved categories are available in this market</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your publishing approvals and the active {marketCountry} taxonomy do not currently overlap. Refresh after an approval or taxonomy change.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => { refresh(); taxonomyQuery.refetch(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh access
        </Button>
        <PublishingOperationsPanel access={access} onRefresh={refresh} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a listing</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">What are you posting?</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Only current taxonomy categories approved for your business and available in {marketCountry} are shown.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {categories.map((category) => {
          const active = formData.listing_category === category.key;
          const Icon = category.icon;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => choose(category)}
              aria-pressed={active}
              className={cn(
                'clay-card relative min-h-[154px] rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30',
                active && 'border-primary/65 bg-primary/5 ring-1 ring-primary/20',
              )}
            >
              {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 fill-primary text-background" />}
              <span className="locked-icon-tile h-12 w-12"><Icon className="h-6 w-6" /></span>
              <h2 className="mt-4 text-base font-extrabold">{category.label}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{category.desc}</p>
            </button>
          );
        })}
      </div>

      {access.pendingCategories.length > 0 && <p className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm">Pending review: {access.pendingCategories.join(', ')}</p>}

      {selected && selected.key !== 'service' && (
        <div className="locked-control rounded-2xl p-4">
          <label htmlFor="listing-subcategory" className="mb-2 block text-sm font-bold">Choose a {selected.label.toLowerCase()} type</label>
          {postableCount > 0 ? (
            <Select value={formData.category || ''} onValueChange={chooseTaxonomyCategory}>
              <SelectTrigger id="listing-subcategory" className="h-12 rounded-xl border-border bg-background/65">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {[...grouped.entries()].map(([groupName, options]) => (
                  <SelectGroup key={groupName}>
                    {groupName !== 'All' && <SelectLabel>{groupName}</SelectLabel>}
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">There are no active postable categories in this marketplace family for {marketCountry} right now.</p>
          )}
        </div>
      )}

      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
      <StepNav showBack={false} onContinue={continueToDetails} />
      <PublishingOperationsPanel access={access} onRefresh={refresh} />
    </div>
  );
}
