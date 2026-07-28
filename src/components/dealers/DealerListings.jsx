import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import ListingCard from '@/components/listings/ListingCard';
import { cn } from '@/lib/utils';

const TYPE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'property', label: 'Property' },
  { value: 'car', label: 'Vehicles' },
  { value: 'machinery', label: 'Machinery' },
];

export default function DealerListings({ listings = [] }) {
  const [activeType, setActiveType] = useState('all');
  const availableTabs = useMemo(
    () => TYPE_TABS.filter((tab) => tab.value === 'all' || listings.some((listing) => listing._type === tab.value)),
    [listings],
  );
  const filtered = useMemo(
    () => (activeType === 'all' ? listings : listings.filter((listing) => listing._type === activeType)),
    [activeType, listings],
  );

  if (listings.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Package className="mx-auto mb-2 h-10 w-10 stroke-1" />
        <p className="text-sm">No active listings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {availableTabs.length > 2 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Filter seller listings">
          {availableTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveType(tab.value)}
              aria-pressed={activeType === tab.value}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors',
                activeType === tab.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {filtered.map((listing) => (
          <ListingCard key={`${listing._type}-${listing.id}`} listing={listing} type={listing._type} />
        ))}
      </div>
    </div>
  );
}
