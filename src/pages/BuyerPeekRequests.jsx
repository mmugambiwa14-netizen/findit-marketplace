import { ArrowLeft, Inbox, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MyPeekRequestsQueue from '@/components/peekThreads/MyPeekRequestsQueue';
import ResponsePeekBindingQueue from '@/components/peekThreads/ResponsePeekBindingQueue';
import SellerPeekRequestsQueueLive from '@/components/peekThreads/SellerPeekRequestsQueueLive';
import { cn } from '@/lib/utils';
import { goBackOrHome } from '@/lib/navigation';

export default function BuyerPeekRequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedResponse = searchParams.get('request');
  const activeView = requestedResponse || searchParams.get('view') === 'answer' ? 'answer' : 'mine';

  const changeView = (view) => {
    const next = new URLSearchParams(searchParams);
    if (view === 'answer') next.set('view', 'answer');
    else next.delete('view');
    if (view === 'mine') next.delete('request');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => goBackOrHome(navigate, '/')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-muted" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0">
            <h1 className="text-lg font-black">Peek Requests</h1>
            <p className="truncate text-xs text-muted-foreground">Track visual evidence you want and respond to buyer demand.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface-secondary p-1.5" role="tablist" aria-label="Peek Request workspace">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'mine'}
            onClick={() => changeView('mine')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
              activeView === 'mine' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Inbox className="h-4 w-4" />My requests
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'answer'}
            onClick={() => changeView('answer')}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
              activeView === 'answer' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Send className="h-4 w-4" />Requests to answer
          </button>
        </div>

        {activeView === 'mine' ? (
          <MyPeekRequestsQueue />
        ) : (
          <div className="-mx-4">
            <ResponsePeekBindingQueue />
            <SellerPeekRequestsQueueLive />
          </div>
        )}
      </div>
    </div>
  );
}
