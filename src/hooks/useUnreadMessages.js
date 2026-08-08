import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { getUnreadMessageCount } from '@/services/messagingService';

export function useUnreadMessages() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['message-inbox', 'unread-count', user?.id],
    queryFn: ({ signal }) => getUnreadMessageCount(signal),
    enabled: featureFlags.messaging && Boolean(user?.id),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  return count;
}
