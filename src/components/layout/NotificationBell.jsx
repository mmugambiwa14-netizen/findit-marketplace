import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useUnreadAlerts } from "@/hooks/useUnreadAlerts";
import { cn } from "@/lib/utils";

export default function NotificationBell({ className = '', iconClassName = '' }) {
  const count = useUnreadAlerts();

  return (
    <Link
      to="/notifications"
      className={cn(
        'relative flex h-[var(--findit-icon-button-size)] w-[var(--findit-icon-button-size)] items-center justify-center rounded-[var(--findit-control-radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell className={cn('h-[var(--findit-icon-size)] w-[var(--findit-icon-size)]', iconClassName)} />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
