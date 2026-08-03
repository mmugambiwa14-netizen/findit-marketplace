import { useEffect, useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePwa } from '@/components/pwa/PwaProvider';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';

/**
 * Install prompt (PWA §6).
 *
 * Three rules shape this, all from "never aggressively spam install prompts":
 *
 * 1. Engagement gating. The prompt never appears on a first page view. Someone
 *    who has not yet decided whether they care about FindIt is not going to
 *    install it, and asking costs the one `beforeinstallprompt` event the
 *    browser gives us.
 * 2. Dismissal is remembered for 30 days (in PwaProvider), and a dismissal from
 *    the browser's own prompt counts too.
 * 3. Already-installed is detected and the prompt never renders — including on
 *    iOS, where `navigator.standalone` is the only signal.
 *
 * iOS gets a different surface entirely. Safari implements no
 * `beforeinstallprompt`, so there is no programmatic install; the only honest
 * option is to show where the Share menu item lives.
 */

const VISIT_COUNT_KEY = '__findit_visit_count';
const IOS_HINT_DISMISSED_KEY = '__findit_ios_install_dismissed_at';
const VISITS_BEFORE_PROMPT = 3;
const IOS_HINT_DISMISS_DAYS = 60;

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ reports as Macintosh; touch points disambiguate.
    || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  // Chrome and Firefox on iOS cannot add to the home screen at all, so the
  // hint would be actively wrong for them.
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && safari;
}

function iosHintRecentlyDismissed() {
  const stored = Number(readStoredString('local', IOS_HINT_DISMISSED_KEY) || 0);
  if (!Number.isFinite(stored) || stored <= 0) return false;
  return Date.now() - stored < IOS_HINT_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/** Counts sessions, not page views, so a single browsing session cannot rush it. */
function recordVisit() {
  const previous = Number(readStoredString('local', VISIT_COUNT_KEY) || 0);
  const next = Number.isFinite(previous) ? previous + 1 : 1;
  writeStoredString('local', VISIT_COUNT_KEY, String(next));
  return next;
}

export default function InstallPrompt() {
  const { canInstall, promptInstall, dismissInstall, standalone } = usePwa();
  const [visits, setVisits] = useState(0);
  const [iosDismissed, setIosDismissed] = useState(iosHintRecentlyDismissed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVisits(recordVisit());
  }, []);

  const engaged = visits >= VISITS_BEFORE_PROMPT;
  const showIosHint = isIosSafari() && !standalone && !iosDismissed && engaged;
  const showInstall = canInstall && engaged;

  if (!showInstall && !showIosHint) return null;

  const handleInstall = async () => {
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  };

  const handleDismissIos = () => {
    writeStoredString('local', IOS_HINT_DISMISSED_KEY, String(Date.now()));
    setIosDismissed(true);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)' }}
    >
      <section
        // A region rather than a dialog: this is an offer, not something that
        // should trap focus or block what the user was doing.
        aria-labelledby="install-prompt-heading"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-floating backdrop-blur"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <SquarePlus className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 id="install-prompt-heading" className="text-sm font-semibold">
            Add FindIt to your home screen
          </h2>

          {showInstall ? (
            <>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Opens full screen, loads faster, and keeps working when your
                connection drops.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleInstall}
                  disabled={busy}
                  className="h-11 rounded-full px-4"
                >
                  {busy ? 'Opening…' : 'Install'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={dismissInstall}
                  className="h-11 rounded-full px-4"
                >
                  Not now
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Tap{' '}
              <Share className="inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" />
              <span className="sr-only">Share</span>{' '}
              in the Safari toolbar, then choose{' '}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          )}
        </div>

        {showIosHint && (
          <button
            type="button"
            onClick={handleDismissIos}
            aria-label="Dismiss install suggestion"
            className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
}
