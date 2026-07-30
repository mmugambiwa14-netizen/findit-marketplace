import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordMarketplaceView } from '@/services/marketplaceViewsService';

export function useMarketplaceView(parentType, parentId, queryKey, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !parentId) return undefined;
    let cancelled = false;

    recordMarketplaceView(parentType, parentId)
      .then((views) => {
        if (cancelled || views == null) return;
        queryClient.setQueryData(queryKey, (current) => (
          current ? { ...current, views } : current
        ));
        queryClient.invalidateQueries({ queryKey: ['public-listing-search-page'] });
      })
      .catch(() => {
        // View counting must never prevent the marketplace item from loading.
      });

    return () => { cancelled = true; };
  }, [enabled, parentId, parentType, queryClient, queryKey]);
}
