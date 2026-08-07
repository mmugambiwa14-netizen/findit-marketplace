import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import BuyerPeekRequestsQueue from '@/components/peekThreads/BuyerPeekRequestsQueue';

const SELLER_QUEUE_REFRESH_MS = 30_000;

export default function SellerPeekRequestsQueueLive() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let stopped = false;
    const refresh = () => {
      if (stopped || document.visibilityState === 'hidden') return;
      queryClient.invalidateQueries({ queryKey: ['seller-peek-request-queue'] });
      queryClient.invalidateQueries({ queryKey: ['unbound-response-peeks'] });
    };

    const interval = window.setInterval(refresh, SELLER_QUEUE_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [queryClient]);

  return <BuyerPeekRequestsQueue />;
}
