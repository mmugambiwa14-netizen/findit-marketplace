import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { featureFlags } from "@/lib/featureFlags";
import { getUnreadNotificationCount } from "@/services/notificationsService";

export function useUnreadAlerts() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["notifications", "unread-count", user?.id],
    queryFn: getUnreadNotificationCount,
    enabled: featureFlags.essentialNotifications && Boolean(user?.id),
    staleTime: 30_000,
  });

  return count;
}
