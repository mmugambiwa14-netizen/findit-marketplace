import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, MapPin } from 'lucide-react';
import { HierarchicalLocationSelector } from '@/components/location/LocationSelector';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { createLoginPath } from '@/lib/authNavigation';

export default function DiscoverHeader({ location, onLocationChange }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const notificationTarget = user && featureFlags.essentialNotifications ? '/notifications' : createLoginPath('/notifications');

  return (
    <div className="flex items-center justify-between gap-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:border-border-strong hover:bg-surface-raised"
            aria-label={`Change location${location?.cityName ? `, currently ${location.cityName}` : ''}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Location</span>
              <span className="block truncate text-sm font-semibold">{location?.cityName || 'All locations'}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="overflow-y-auto">
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

      <Link
        to={notificationTarget}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        aria-label={user ? 'Open notifications' : 'Sign in for notifications'}
      >
        <Bell className="h-[19px] w-[19px]" />
      </Link>
    </div>
  );
}
