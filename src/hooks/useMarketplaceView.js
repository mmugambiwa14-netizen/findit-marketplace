import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { recordMarketplaceView } from '@/services/marketplaceViewsService';

export function useMarketplaceView(parentType, parentId, queryKeyPrefix, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !parentId || !queryKeyPrefix) return undefined;
    let cancelled = false;

    recordMarketplaceView(parentType, parentId)
      .then((views) => {
        if (cancelled || views == null) return;
        queryClient.setQueryData([queryKeyPrefix, parentId], (current) => (
          current ? { ...current, views } : current
        ));
        queryClient.invalidateQueries({ queryKey: ['public-listing-search-page'] });
      })
      .catch(() => {
        // View counting must never prevent the marketplace item from loading.
      });

    return () => { cancelled = true; };
  }, [enabled, parentId, parentType, queryClient, queryKeyPrefix]);
}
