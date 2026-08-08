import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { featureFlags } from "@/lib/featureFlags";
import { getUnreadNotificationCount } from "@/services/notificationsService";

const UNREAD_REFRESH_MS = 30_000;

export function useUnreadAlerts() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["notifications", "unread-count", user?.id],
    queryFn: ({ signal }) => getUnreadNotificationCount(signal),
    enabled: featureFlags.essentialNotifications && Boolean(user?.id),
    staleTime: 10_000,
    refetchInterval: UNREAD_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  return count;
}
