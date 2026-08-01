import { List, Loader2, Map } from 'lucide-react';
import ListingGrid from '@/components/listings/ListingGrid';
import SearchResultsMap from '@/components/search/SearchResultsMap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ListingResults({
  listings,
  type,
  isLoading,
  isFetching,
  isFetchingNextPage,
  isError,
  onRetry,
  hasNextPage,
  onLoadMore,
  hasFilters,
  onClearFilters,
  mapsEnabled = false,
  viewMode = 'list',
  onViewModeChange = null,
}) {
  const loaded = listings.length;
  const showMap = mapsEnabled && viewMode === 'map';

  return (
    <section aria-labelledby="listing-results-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 id="listing-results-title" className="findit-section-title">Results</h2>
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? 'Loading listings...' : loaded === 0 ? 'No listings found' : `${loaded.toLocaleString()} listing${loaded === 1 ? '' : 's'} loaded`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mapsEnabled && (
            <div className="clay-control grid h-11 grid-cols-2 rounded-xl p-1" role="group" aria-label="Results view">
              {[
                { value: 'list', label: 'List', icon: List },
                { value: 'map', label: 'Map', icon: Map },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onViewModeChange?.(value)}
                  aria-pressed={viewMode === value}
                  className={cn(
                    'inline-flex min-w-16 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold',
                    viewMode === value ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
          {isFetching && !isLoading && !isFetchingNextPage && <span className="text-xs text-muted-foreground">Updating</span>}
        </div>
      </div>

      {isError ? (
        <div className="clay-card rounded-2xl py-14 text-center">
          <p className="font-medium">Search is temporarily unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">Your current filters have been preserved.</p>
          <Button variant="outline" className="clay-control mt-4" onClick={onRetry}>Retry</Button>
        </div>
      ) : (
        <>
          {showMap && !isLoading ? <SearchResultsMap listings={listings} type={type} /> : <ListingGrid listings={listings} type={type} isLoading={isLoading} />}

          {!isLoading && loaded === 0 && hasFilters && (
            <div className="pb-10 pt-4 text-center"><Button variant="outline" className="clay-control" onClick={onClearFilters}>Clear filters</Button></div>
          )}

          {!isLoading && hasNextPage && (
            <div className="mt-7 flex justify-center">
              <Button variant="outline" className="clay-control min-w-44" disabled={isFetchingNextPage} onClick={onLoadMore}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more listings'}
              </Button>
            </div>
          )}

          {!isLoading && !hasNextPage && loaded > 0 && <p className="mt-7 pb-5 text-center text-xs text-muted-foreground">You have reached the end of these results.</p>}
        </>
      )}
    </section>
  );
}
