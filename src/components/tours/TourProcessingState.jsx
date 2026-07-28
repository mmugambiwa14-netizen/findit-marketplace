import { CheckCircle2, Clock3, Loader2, ShieldCheck } from 'lucide-react';

const STATE = {
  upload_authorized: { icon: Loader2, label: 'Upload started', detail: 'The upload has not been confirmed yet.', spin: true },
  uploaded: { icon: Clock3, label: 'Queued for processing', detail: 'The source video is private while processing starts.' },
  processing: { icon: Loader2, label: 'Processing Tour', detail: 'FindIt is validating the video and preparing 720p playback.', spin: true },
  ready: { icon: ShieldCheck, label: 'Ready for review', detail: 'Processing is complete. The Tour will appear after moderation approval.' },
};

export default function TourProcessingState({ tour }) {
  const state = STATE[tour?.status] || STATE.uploaded;
  const Icon = state.icon;
  const approved = tour?.status === 'ready' && tour?.moderation_status === 'approved';
  return (
    <div className="rounded-xl border border-border bg-muted/15 p-4" role="status">
      <div className="flex gap-3">
        {approved ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /> : <Icon className={`mt-0.5 h-5 w-5 text-primary ${state.spin ? 'animate-spin' : ''}`} />}
        <div>
          <p className="text-sm font-semibold">{approved ? 'Tour approved' : state.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{approved ? 'The Tour is ready and follows the parent listing availability.' : state.detail}</p>
        </div>
      </div>
    </div>
  );
}
