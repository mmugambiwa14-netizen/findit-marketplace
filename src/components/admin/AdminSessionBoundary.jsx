import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const WARNING_WINDOW_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

export default function AdminSessionBoundary({ children }) {
  const { logout, user } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const [remainingMs, setRemainingMs] = useState(IDLE_LIMIT_MS);
  const [timedOut, setTimedOut] = useState(false);

  const markActive = useCallback(() => {
    if (timedOut) return;
    lastActivityRef.current = Date.now();
    setRemainingMs(IDLE_LIMIT_MS);
  }, [timedOut]);

  useEffect(() => {
    for (const eventName of ACTIVITY_EVENTS) window.addEventListener(eventName, markActive, { passive: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') markActive();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, IDLE_LIMIT_MS - (Date.now() - lastActivityRef.current));
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0) setTimedOut(true);
    }, 1000);

    return () => {
      window.clearInterval(timer);
      for (const eventName of ACTIVITY_EVENTS) window.removeEventListener(eventName, markActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [markActive]);

  useEffect(() => {
    if (!timedOut) return;
    void logout(false);
  }, [logout, timedOut]);

  if (timedOut) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-floating">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><ShieldAlert className="h-5 w-5" /></span>
          <h1 className="mt-4 text-xl font-black">Admin session locked</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The console signed out after 15 minutes without activity. Sign in again before continuing.</p>
          <Button className="mt-5 w-full" onClick={() => { window.location.href = '/login'; }}>Sign in again</Button>
        </section>
      </main>
    );
  }

  const warningVisible = remainingMs <= WARNING_WINDOW_MS;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  return (
    <>
      {warningVisible && (
        <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-warning/30 bg-card p-3 shadow-floating" role="alert">
          <Clock3 className="h-5 w-5 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-sm"><span className="font-bold">Session expires soon.</span> Activity is required within {remainingMinutes} minute{remainingMinutes === 1 ? '' : 's'}.</p>
          <Button size="sm" variant="outline" onClick={markActive}>Stay signed in</Button>
        </div>
      )}
      <div data-admin-user={user?.id || ''}>{children}</div>
    </>
  );
}
