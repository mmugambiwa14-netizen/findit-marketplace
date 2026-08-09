import { useEffect, useRef, useState } from 'react';
import { Eye, Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getResponsePeekPlayback } from '@/services/peekThreadsService';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function ResponsePeekWatchButton({ tourId, title = 'Response Peek' }) {
  const videoRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playback, setPlayback] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) videoRef.current?.pause();
  }, [open]);

  const load = async () => {
    if (loading) return;
    setOpen(true);
    setFailed(false);
    const expiresAt = Number(playback?.expiresAt || 0);
    if (playback?.playbackUrl && expiresAt > Date.now() + 10_000) return;
    setLoading(true);
    try {
      const result = await getResponsePeekPlayback(tourId);
      setPlayback({
        ...result,
        expiresAt: Date.now() + Math.max(1, Number(result.expiresInSeconds) || 1) * 1000,
      });
    } catch (error) {
      setFailed(true);
      toast.error(error?.message || 'This Response Peek is temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
        Watch Peek
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
          <div className="w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/10 bg-background shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Visual evidence</p>
                <h3 className="text-base font-bold">{title}</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-secondary" aria-label="Close Response Peek">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              {loading ? (
                <SkeletonRegion label="Preparing secure playback" className="h-full p-5"><Skeleton className="h-full w-full bg-white/15" /></SkeletonRegion>
              ) : playback?.playbackUrl && !failed ? (
                <video
                  ref={videoRef}
                  src={playback.playbackUrl}
                  poster={playback.thumbnailUrl || undefined}
                  controls
                  playsInline
                  autoPlay
                  preload="metadata"
                  className="h-full w-full object-contain"
                  onError={() => setFailed(true)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
                  <RotateCcw className="h-7 w-7" />
                  <p className="text-sm font-semibold">Response Peek playback failed</p>
                  <Button type="button" variant="secondary" onClick={load}>Try again</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
