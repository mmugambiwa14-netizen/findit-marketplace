import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { getMessageInbox } from '@/services/messagingService';

export function useUnreadMessages() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['message-inbox', 'unread-count', user?.id],
    queryFn: async () => {
      const result = await getMessageInbox({
        query: '',
        unreadOnly: true,
        limit: 1,
        offset: 0,
      });
      return Math.max(0, Number(result.total) || 0);
    },
    enabled: featureFlags.messaging && Boolean(user?.id),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return count;
}
