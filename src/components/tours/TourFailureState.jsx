import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TourFailureState({ tour, onRetry = null, retrying = false, onRemove = null, removing = false }) {
  const rejected = tour?.moderation_status === 'rejected';
  const message = rejected
    ? tour?.rejection_reason || 'This Tour is unavailable. Upload a corrected video below.'
    : tour?.failure_message || 'Processing did not finish. Retry processing, or remove this version and upload another video.';

  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{rejected ? 'Tour unavailable' : 'Tour processing failed'}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{message}</p>
          {tour?.failure_code && !rejected && <p className="mt-1 text-[11px] text-muted-foreground">Reference: {tour.failure_code}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && !rejected && <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying || removing}><RotateCcw />{retrying ? 'Queuing...' : 'Retry processing'}</Button>}
            {onRemove && <Button type="button" size="sm" variant="ghost" onClick={onRemove} disabled={retrying || removing}><Trash2 />{removing ? 'Removing...' : rejected ? 'Remove unavailable Tour' : 'Discard this version'}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
