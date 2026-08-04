import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePwa } from '@/components/pwa/PwaProvider';

export default function GlobalRefreshButton() {
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
      className="fixed right-3 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-primary/35 bg-card/95 text-foreground shadow-floating backdrop-blur-xl transition hover:border-primary/60 hover:text-primary disabled:cursor-wait disabled:opacity-70 md:bottom-4 md:right-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.65rem)' }}
    >
      <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
    </button>
  );
}
