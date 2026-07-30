import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import TourReportDialog from '@/components/tours/TourReportDialog';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function TourReportAction({ tourId, title, sellerId, onReported, className = null, variant = 'overlay' }) {
  const { user } = useAuth();
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  if (!tourId || (user?.id && user.id === sellerId)) return null;

  const open = () => {
    if (!user) setGuestOpen(true);
    else setDialogOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={cn(
          'flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
          variant === 'surface'
            ? 'border-border bg-surface-secondary text-muted-foreground hover:bg-surface-raised hover:text-foreground'
            : 'border-white/15 bg-black/60 text-white backdrop-blur-md hover:bg-black/80',
          className,
        )}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report Peek
      </button>
      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action="report this Peek" returnTo={`${location.pathname}${location.search}`} />
      <TourReportDialog open={dialogOpen} onOpenChange={setDialogOpen} tourId={tourId} title={title} onReported={onReported} />
    </>
  );
}
