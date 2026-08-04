import { Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ListingMediaActions({
  onShare = null,
  onSave = null,
  isSaved = false,
  isSaving = false,
  showSave = true,
}) {
  if (!onShare && (!showSave || !onSave)) return null;

  return (
    <div className="absolute bottom-2.5 right-3 z-30 flex items-center gap-1.5 sm:right-4">
      {onShare && (
        <MediaActionButton label="Share" onClick={onShare}>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Share</span>
        </MediaActionButton>
      )}
      {showSave && onSave && (
        <MediaActionButton
          label={isSaving ? "Saving" : isSaved ? "Remove from saved" : "Save"}
          onClick={onSave}
          disabled={isSaving}
          active={isSaved}
        >
          <Bookmark className={cn("h-3.5 w-3.5", isSaved && "fill-current")} aria-hidden="true" />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </MediaActionButton>
      )}
    </div>
  );
}

function MediaActionButton({ label, onClick, disabled = false, active = false, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60",
        active
          ? "border-primary/35 bg-primary/15 text-primary"
          : "border-border bg-card/95 text-foreground hover:bg-surface-secondary",
      )}
    >
      {children}
    </button>
  );
}
