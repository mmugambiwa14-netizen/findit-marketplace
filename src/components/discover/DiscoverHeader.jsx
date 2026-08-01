import { useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { HierarchicalLocationSelector } from '@/components/location/LocationSelector';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function DiscoverHeader({ location, onLocationChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="clay-control flex min-h-12 w-full min-w-0 items-center gap-3 rounded-2xl px-3.5 text-left hover:border-primary/25 sm:min-h-14 sm:px-4"
            aria-label={`Change location${location?.cityName ? `, currently ${location.cityName}` : ''}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary sm:h-9 sm:w-9">
              <MapPin className="h-4 w-4 fill-primary/10" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {location?.cityName || 'All locations'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="overflow-y-auto border-border bg-background">
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>Choose a location</SheetTitle>
            <SheetDescription>Use a public city-level location to narrow marketplace results.</SheetDescription>
          </SheetHeader>
          <div className="py-5">
            {open && (
              <HierarchicalLocationSelector
                value={location}
                onSelectLocation={(nextLocation) => {
                  onLocationChange(nextLocation);
                  setOpen(false);
                }}
              />
            )}
            {location?.city && (
              <button
                type="button"
                onClick={() => {
                  onLocationChange(null);
                  setOpen(false);
                }}
                className="mt-5 min-h-11 text-sm font-semibold text-primary hover:text-primary-hover"
              >
                Browse all locations
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
