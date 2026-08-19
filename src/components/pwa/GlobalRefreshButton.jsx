import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePwa } from '@/components/pwa/PwaProvider';
import { cn } from '@/lib/utils';

export default function GlobalRefreshButton({ inline = false, desktop = false, className = '' }) {
  const { refreshApp } = usePwa();
  const [refreshing, setRefreshing] = useState(false);

  if (!inline && !desktop) return null;

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshApp();
    } catch {
      setRefreshing(false);
      toast.error('Could not refresh PeekaListing. Check your connection and try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh PeekaListing"
      title="Refresh PeekaListing"
      className={cn(
        'relative flex h-[var(--findit-icon-button-size)] w-[var(--findit-icon-button-size)] shrink-0 items-center justify-center rounded-[var(--findit-control-radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70',
        className,
      )}
    >
      <RefreshCw className={cn('h-[var(--findit-icon-size)] w-[var(--findit-icon-size)]', refreshing && 'animate-spin')} aria-hidden="true" />
    </button>
  );
}
