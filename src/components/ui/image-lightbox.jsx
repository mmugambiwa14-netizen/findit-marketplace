import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ImageLightbox({
  images = [],
  index = 0,
  onIndexChange,
  open = false,
  onOpenChange,
  title = "Photo",
}) {
  const total = images.length;
  const safeIndex = total ? Math.min(Math.max(index, 0), total - 1) : 0;
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [safeIndex, open]);

  const step = useCallback((delta) => {
    if (total < 2) return;
    onIndexChange?.((safeIndex + delta + total) % total);
  }, [onIndexChange, safeIndex, total]);

  const onKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  if (!total) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={onKeyDown}
        className="left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-black/95 p-0 [&>button]:right-[max(1rem,env(safe-area-inset-right))] [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:z-30 [&>button]:bg-black/45 [&>button]:text-white [&>button]:backdrop-blur-md"
      >
        <DialogTitle className="sr-only">{`${title}, photo ${safeIndex + 1} of ${total}`}</DialogTitle>

        <div className={cn(
          "h-full w-full pb-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))]",
          zoomed ? "overflow-auto" : "flex items-center justify-center overflow-hidden",
        )}>
          <img
            src={images[safeIndex]}
            alt={`${title}, photo ${safeIndex + 1} of ${total}`}
            onClick={() => setZoomed((value) => !value)}
            loading="eager"
            decoding="async"
            className={cn(
              "select-none",
              zoomed
                ? "h-auto w-auto max-w-none cursor-zoom-out"
                : "max-h-full max-w-full cursor-zoom-in object-contain",
            )}
          />
        </div>

        {total > 1 && (
          <>
            <LightboxArrow label="Previous photo" side="left" onClick={() => step(-1)}>
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </LightboxArrow>
            <LightboxArrow label="Next photo" side="right" onClick={() => step(1)}>
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </LightboxArrow>
            <p className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold tabular-nums text-white/90 backdrop-blur-md">
              {`${safeIndex + 1} / ${total}`}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LightboxArrow({ label, side, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        side === "left"
          ? "left-[max(0.75rem,env(safe-area-inset-left))]"
          : "right-[max(0.75rem,env(safe-area-inset-right))]",
      )}
    >
      {children}
    </button>
  );
}
