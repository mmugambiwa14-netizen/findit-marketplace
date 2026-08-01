import { useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { HierarchicalLocationSelector } from '@/components/location/LocationSelector';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { shouldCommitDiscoverLocationSelection } from '@/components/discover/discoverLocationSelection';

export default function DiscoverHeader({ location, onLocationChange }) {
  const [open, setOpen] = useState(false);

  const handleLocationSelection = (nextLocation) => {
    if (!shouldCommitDiscoverLocationSelection(nextLocation)) return;

    onLocationChange(nextLocation);
    setOpen(false);
  };

  return (
    <div className="min-w-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="locked-control flex h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl px-3.5 text-left hover:border-primary/25"
            aria-label={`Change location${location?.cityName ? `, currently ${location.cityName}` : ''}`}
          >
            <MapPin className="h-4.5 w-4.5 shrink-0 fill-primary/12 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{location?.cityName || 'All locations'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[calc(100dvh-0.75rem)] touch-pan-y overflow-y-auto overscroll-contain border-border bg-background"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>Choose a location</SheetTitle>
            <SheetDescription>Choose any registered city, town, village, suburb, or neighbourhood to narrow results.</SheetDescription>
          </SheetHeader>
          <div className="py-5">
            {open && <HierarchicalLocationSelector value={location} onSelectLocation={handleLocationSelection} />}
            {location?.city && <button type="button" onClick={() => { onLocationChange(null); setOpen(false); }} className="mt-5 min-h-11 text-sm font-semibold text-primary hover:text-primary-hover">Browse all locations</button>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
