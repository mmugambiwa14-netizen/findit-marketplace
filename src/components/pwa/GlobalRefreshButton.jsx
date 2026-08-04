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
        'flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70',
        desktop
          ? 'shrink-0'
          : 'fixed right-[4.25rem] z-[75] md:hidden',
      )}
      style={desktop ? undefined : { top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
    >
      <RefreshCw className={cn('h-[18px] w-[18px]', refreshing && 'animate-spin')} aria-hidden="true" />
    </button>
  );
}
