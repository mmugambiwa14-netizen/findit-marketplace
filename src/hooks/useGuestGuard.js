import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Returns { guestOpen, guestAction, guard, closeGuest }
 * Call guard(action, fn) — if user is logged in, fn() runs immediately.
 * If guest, a prompt sheet opens with a contextual action message.
 */
export function useGuestGuard() {
  const { user } = useAuth();
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState("do that");

  const guard = (action, fn) => {
    if (!user) {
      setGuestAction(action);
      setGuestOpen(true);
      return;
    }
    fn?.();
  };

  const closeGuest = () => setGuestOpen(false);

  return { guestOpen, guestAction, guard, closeGuest };
}