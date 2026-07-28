import { useQuery } from '@tanstack/react-query';
import ListingCard from './ListingCard';
import { useAuth } from '@/lib/AuthContext';
import { getFavouriteIds } from '@/services/favouritesService';

export default function ListingGrid({ listings = [], type = 'property', onSave = null, savedIds = [], isLoading = false }) {
  const { user } = useAuth();
  const listingIds = listings.map((listing) => listing.id);
  const listingIdsKey = [...listingIds].sort().join(',');
  const { data: fetchedFavouriteIds = [] } = useQuery({
    queryKey: ['favourites', user?.id, listingIdsKey],
    queryFn: () => getFavouriteIds(user.id, listingIds),
    enabled: Boolean(user?.id) && listingIds.length > 0,
    staleTime: 1000 * 60,
  });
  const favouriteIds = new Set([...savedIds, ...fetchedFavouriteIds]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4" aria-label="Loading listings">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <div key={item} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="aspect-[4/3] animate-pulse bg-surface-raised" />
            <div className="space-y-2 p-3"><div className="h-4 w-5/6 animate-pulse rounded bg-surface-raised" /><div className="h-3 w-3/5 animate-pulse rounded bg-surface-raised" /><div className="h-3 w-full animate-pulse rounded bg-surface-raised" /></div>
          </div>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-card/40 py-14 text-center text-muted-foreground">
        <p className="text-sm font-medium text-foreground">No listings found</p>
        <p className="mt-1 text-xs">Try changing your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} type={type} onSave={onSave} isSaved={favouriteIds.has(listing.id)} />
      ))}
    </div>
  );
}
