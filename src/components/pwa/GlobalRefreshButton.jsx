import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePwa } from '@/components/pwa/PwaProvider';
import { cn } from '@/lib/utils';

export default function GlobalRefreshButton({ desktop = false }) {
  const { refreshApp } = usePwa();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshApp();
    } catch {
      setRefreshing(false);
      toast.error('Could not refresh FindIt. Check your connection and try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh FindIt"
      title="Refresh FindIt"
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 text-muted-foreground shadow-sm backdrop-blur-xl transition hover:border-primary/40 hover:text-primary disabled:cursor-wait disabled:opacity-70',
        desktop
          ? 'shrink-0'
          // The far-right mobile top-bar slot belongs to the page action
          // (notifications, settings, overflow menu). Refresh occupies the
          // adjacent slot so the controls never overlap.
          : 'fixed right-[4.25rem] z-[75] md:hidden',
      )}
      style={desktop ? undefined : { top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} aria-hidden="true" />
    </button>
  );
}
