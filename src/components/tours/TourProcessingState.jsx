import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldCheck } from 'lucide-react';

const STATE = {
  upload_authorized: { icon: Loader2, label: 'Upload started', detail: 'The upload has not been confirmed yet.', spin: true },
  uploaded: { icon: Clock3, label: 'Queued for processing', detail: 'The source video is private while processing starts.' },
  processing: { icon: Loader2, label: 'Processing Peek', detail: 'FindIt is validating the video and preparing 720p playback.', spin: true },
  ready: { icon: ShieldCheck, label: 'Processing complete', detail: 'The Peek will appear when it is active and the parent remains public.' },
};

// A Peek that never gets claimed by the processing worker stays in a transient
// status forever, and an optimistic "queued" message leaves the seller waiting
// on something that will never arrive. Past these budgets, say so plainly.
const STALL_BUDGET_MS = {
  upload_authorized: 5 * 60_000,
  uploaded: 10 * 60_000,
  processing: 15 * 60_000,
};

// Earliest timestamp that marks entry into each status, most specific first.
const STALL_CLOCK_FIELDS = {
  upload_authorized: ['created_at'],
  uploaded: ['uploaded_at', 'created_at'],
  processing: ['processing_started_at', 'uploaded_at', 'created_at'],
};

function enteredStatusAt(tour) {
  for (const field of STALL_CLOCK_FIELDS[tour?.status] ?? []) {
    const parsed = Date.parse(tour?.[field] ?? '');
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function describeElapsed(milliseconds) {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'a day' : `${days} days`;
}

function useStalledFor(tour) {
  const budget = STALL_BUDGET_MS[tour?.status];
  const enteredAt = budget == null ? null : enteredStatusAt(tour);
  const [elapsed, setElapsed] = useState(() => (enteredAt == null ? null : Date.now() - enteredAt));

  useEffect(() => {
    if (enteredAt == null) {
      setElapsed(null);
      return undefined;
    }
    const measure = () => setElapsed(Date.now() - enteredAt);
    measure();
    const timer = setInterval(measure, 30_000);
    return () => clearInterval(timer);
  }, [enteredAt]);

  return budget != null && elapsed != null && elapsed > budget ? elapsed : null;
}

export default function TourProcessingState({ tour }) {
  const state = STATE[tour?.status] || STATE.uploaded;
  const Icon = state.icon;
  const approved = tour?.status === 'ready' && tour?.moderation_status === 'approved';
  const stalledFor = useStalledFor(tour);

  if (!approved && stalledFor != null) {
    return (
      <div className="rounded-xl border border-warning/25 bg-warning/5 p-4" role="status">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-semibold">Taking longer than expected</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {`This Peek has been waiting to process for ${describeElapsed(stalledFor)}. Your video is stored safely and your listing is unaffected, but processing normally finishes within a few minutes. If it has not moved on shortly, contact support and mention this listing.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/15 p-4" role="status">
      <div className="flex gap-3">
        {approved ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /> : <Icon className={`mt-0.5 h-5 w-5 text-primary ${state.spin ? 'animate-spin' : ''}`} />}
        <div>
          <p className="text-sm font-semibold">{approved ? 'Peek active' : state.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{approved ? 'The Peek is ready and follows the parent listing availability.' : state.detail}</p>
        </div>
      </div>
    </div>
  );
}
