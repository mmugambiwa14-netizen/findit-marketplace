import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addServiceFavourite, getServiceFavourite, removeServiceFavourite } from '@/services/serviceFavouritesService';

export function useServiceFavourite({ userId, serviceId, queryClient, guard }) {
  const favouriteQuery = useQuery({
    queryKey: ['service-favourite', userId, serviceId],
    queryFn: () => getServiceFavourite(userId, serviceId),
    enabled: Boolean(userId && serviceId),
    staleTime: 60_000,
  });

  const isSaved = Boolean(favouriteQuery.data);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId || !serviceId) throw new Error('Sign in to save services.');
      if (isSaved) await removeServiceFavourite(userId, serviceId);
      else await addServiceFavourite(userId, serviceId);
      return !isSaved;
    },
    onSuccess: async (saved) => {
      toast.success(saved ? 'Saved' : 'Removed from saved');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-favourite', userId, serviceId] }),
        queryClient.invalidateQueries({ queryKey: ['service-favourites', userId] }),
        queryClient.invalidateQueries({ queryKey: ['favourite-services', userId] }),
      ]);
    },
    onError: (error) => toast.error(error.message || 'Could not update saved services.'),
  });

  const toggle = () => {
    if (mutation.isPending) return;
    guard('save services', () => mutation.mutate());
  };

  return {
    isSaved,
    isSaving: mutation.isPending,
    toggle,
    favouriteError: favouriteQuery.error || null,
  };
}
