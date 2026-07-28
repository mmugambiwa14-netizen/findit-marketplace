import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addFavourite, getFavourite, removeFavourite } from '@/services/favouritesService';

export function useListingFavourite({ userId, listingId, queryClient, guard }) {
  const favouriteQuery = useQuery({
    queryKey: ['favourite', userId, listingId],
    queryFn: () => getFavourite(userId, listingId),
    enabled: Boolean(userId && listingId),
    staleTime: 60_000,
  });

  const isSaved = Boolean(favouriteQuery.data);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId || !listingId) throw new Error('Sign in to save listings.');
      if (isSaved) await removeFavourite(userId, listingId);
      else await addFavourite(userId, listingId);
      return !isSaved;
    },
    onSuccess: async (saved) => {
      toast.success(saved ? 'Saved' : 'Removed from saved');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favourite', userId, listingId] }),
        queryClient.invalidateQueries({ queryKey: ['favourites', userId] }),
        queryClient.invalidateQueries({ queryKey: ['favourite-listings', userId] }),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update saved listings.');
    },
  });

  const toggle = () => {
    if (mutation.isPending) return;
    guard('save listings', () => mutation.mutate());
  };

  return {
    isSaved,
    isSaving: mutation.isPending,
    toggle,
    favouriteError: favouriteQuery.error || null,
  };
}
