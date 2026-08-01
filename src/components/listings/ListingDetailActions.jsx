import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDIA_CONTROLS_EVENT = "findit:media-controls-visibility";

export default function ListingDetailActions({ onBack, onShare = null, onSave = null, isSaved = false, isSaving = false, showSave = true }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleVisibility = (event) => {
      const detail = event?.detail || {};
      setVisible(detail.active === true ? detail.visible !== false : true);
    };
    window.addEventListener(MEDIA_CONTROLS_EVENT, handleVisibility);
    return () => window.removeEventListener(MEDIA_CONTROLS_EVENT, handleVisibility);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 safe-area-top">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <ActionButton label="Go back" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </ActionButton>
        <div className="flex gap-2">
          {onShare && (
            <ActionButton label="Share listing" onClick={onShare}>
              <Share2 className="h-4.5 w-4.5" aria-hidden="true" />
            </ActionButton>
          )}
          {showSave && onSave && (
            <ActionButton label={isSaving ? "Updating saved listing" : isSaved ? "Remove from saved" : "Save listing"} onClick={onSave} disabled={isSaving}>
              <Heart className={cn("h-4.5 w-4.5", isSaved && "fill-destructive text-destructive")} aria-hidden="true" />
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="clay-icon pointer-events-auto h-11 w-11 border-white/10 bg-card/90 text-foreground backdrop-blur-xl disabled:cursor-wait disabled:opacity-60"
    >
      {children}
    </button>
  );
}
