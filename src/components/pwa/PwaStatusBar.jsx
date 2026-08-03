import { CloudOff, Download, RefreshCw, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePwa } from '@/components/pwa/PwaProvider';

/**
 * Connectivity and update surfaces (PWA §11, §16, §17).
 *
 * Deliberately not a toast. Offline is a persistent condition, not an event,
 * and a toast that auto-dismisses leaves someone wondering why saving keeps
 * failing. The bar stays for as long as the condition does.
 *
 * Accessibility notes:
 * - `role="status"` with `aria-live="polite"` announces changes without
 *   stealing focus from whatever the user is typing.
 * - Nothing here is focus-trapped or modal: an offline user must still be able
 *   to read and navigate everything already loaded.
 * - Buttons meet the 44px touch target used elsewhere in the app.
 * - Sits above the bottom navigation, offset by the safe-area inset so it is
 *   not swallowed by a home indicator.
 */

const WRAPPER = 'pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3';

export default function PwaStatusBar() {
  const { reachable, wasOffline, slow, updateReady, applyUpdate } = usePwa();

  const showOffline = !reachable;
  const showRestored = reachable && wasOffline;
  const showSlow = reachable && !wasOffline && slow;

  if (!showOffline && !showRestored && !showSlow && !updateReady) return null;

  return (
    <div
      className={WRAPPER}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)' }}
    >
      {(showOffline || showRestored || showSlow) && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-floating backdrop-blur',
            showOffline
              ? 'border-destructive/30 bg-destructive/10 text-destructive-foreground'
              : showRestored
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-border bg-card/95',
          ].join(' ')}
        >
          {showOffline
            ? <CloudOff className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            : showRestored
              ? <Wifi className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              : <Wifi className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}

          <p className="min-w-0 flex-1 text-sm">
            {showOffline && (
              <>
                <span className="font-semibold">You&apos;re offline.</span>{' '}
                <span className="text-muted-foreground">
                  Everything you&apos;ve already opened stays available.
                </span>
              </>
            )}
            {showRestored && <span className="font-semibold">Back online.</span>}
            {showSlow && (
              <span className="text-muted-foreground">
                Your connection is slow — images may take a moment.
              </span>
            )}
          </p>
        </div>
      )}

      {updateReady && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-floating backdrop-blur"
        >
          <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">A new version is ready.</span>{' '}
            <span className="text-muted-foreground">Reload when you&apos;re ready.</span>
          </p>
          {/* Not automatic: reloading mid-listing would discard a draft in
              progress, so the moment is the user's to choose (§17). */}
          <Button
            type="button"
            size="sm"
            onClick={applyUpdate}
            className="h-11 shrink-0 rounded-full px-4"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reload
          </Button>
        </div>
      )}
    </div>
  );
}
