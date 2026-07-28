import { Loader2 } from 'lucide-react';

export default function TourUploadProgress({ progress }) {
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{progress?.message || 'Uploading Tour'}</span>
            <span className="tabular-nums text-muted-foreground">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Keep this page open until the upload is confirmed. Processing continues after the upload finishes.</p>
    </div>
  );
}
