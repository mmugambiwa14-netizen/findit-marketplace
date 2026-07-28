import { Loader2 } from 'lucide-react';
import ListingGrid from '@/components/listings/ListingGrid';
import { Button } from '@/components/ui/button';

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
}) {
  const loaded = listings.length;

  return (
    <section aria-labelledby="listing-results-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="listing-results-title" className="text-sm font-semibold">Results</h2>
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? 'Loading listings...' : loaded === 0 ? 'No listings found' : `${loaded.toLocaleString()} listing${loaded === 1 ? '' : 's'} loaded`}
          </p>
        </div>
        {isFetching && !isLoading && !isFetchingNextPage && <span className="text-xs text-muted-foreground">Updating</span>}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-border bg-card py-14 text-center">
          <p className="font-medium">Search is temporarily unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">Your current filters have been preserved.</p>
          <Button variant="outline" className="mt-4" onClick={onRetry}>Retry</Button>
        </div>
      ) : (
        <>
          <ListingGrid listings={listings} type={type} isLoading={isLoading} />

          {!isLoading && loaded === 0 && hasFilters && (
            <div className="pb-10 pt-4 text-center">
              <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
            </div>
          )}

          {!isLoading && hasNextPage && (
            <div className="mt-7 flex justify-center">
              <Button variant="outline" className="min-w-44" disabled={isFetchingNextPage} onClick={onLoadMore}>
                {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more listings'}
              </Button>
            </div>
          )}

          {!isLoading && !hasNextPage && loaded > 0 && (
            <p className="mt-7 text-center text-xs text-muted-foreground">You have reached the end of these results.</p>
          )}
        </>
      )}
    </section>
  );
}
