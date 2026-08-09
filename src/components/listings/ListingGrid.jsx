import { useQuery } from '@tanstack/react-query';
import ListingCard from './ListingCard';
import { useAuth } from '@/lib/AuthContext';
import { getFavouriteIds } from '@/services/favouritesService';
import { CardGridSkeleton } from '@/components/loading/LoadingSkeletons';

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
    return <CardGridSkeleton />;
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} type={type} onSave={onSave} isSaved={favouriteIds.has(listing.id)} />
      ))}
    </div>
  );
}
