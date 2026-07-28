import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useUnreadAlerts } from "@/hooks/useUnreadAlerts";

export default function NotificationBell() {
  const count = useUnreadAlerts();

  return (
    <Link
      to="/notifications"
      className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className="w-[18px] h-[18px]" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
