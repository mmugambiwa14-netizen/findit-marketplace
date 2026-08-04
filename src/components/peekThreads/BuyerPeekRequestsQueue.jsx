import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Clock3, Eye, Loader2, MessageSquareMore, Users, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TourUploader from '@/components/tours/TourUploader';
import { peekRequestCategoryLabel } from '@/domain/peekThreads/categories';
import { declinePeekRequest, getSellerPeekRequestQueue } from '@/services/peekThreadsService';
import { queueResponsePeekBinding } from '@/services/responsePeekBindingIntentService';

function parentPath(item) {
  if (item.parentType === 'service') return `/service/${item.parentId}`;
  if (item.parentKind === 'car') return `/car/${item.parentId}`;
  if (item.parentKind === 'machinery') return `/machinery/${item.parentId}`;
  return `/property/${item.parentId}`;
}

function waitingLabel(seconds) {
  const hours = Math.max(0, Math.floor(Number(seconds) / 3600));
  if (hours < 1) return 'Less than an hour';
  if (hours < 24) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

export default function BuyerPeekRequestsQueue() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('request');
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [responseTarget, setResponseTarget] = useState(null);
  const [responseDraft, setResponseDraft] = useState(null);
  const [responseBusy, setResponseBusy] = useState(false);
  const [bindingBusy, setBindingBusy] = useState(false);

  const queue = useInfiniteQuery({
    queryKey: ['seller-peek-request-queue'],
    queryFn: ({ pageParam }) => getSellerPeekRequestQueue({ cursor: pageParam || null, limit: 20 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor || undefined,
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const byId = new Map();
    for (const page of queue.data?.pages || []) for (const item of page.items) byId.set(item.requestId, item);
    return [...byId.values()];
  }, [queue.data]);

  useEffect(() => {
    if (!requestedId || responseTarget) return;
    const match = items.find((item) => item.requestId === requestedId);
    if (match) {
      setResponseDraft(null);
      setResponseTarget(match);
      return;
    }
    if (queue.hasNextPage && !queue.isFetchingNextPage) queue.fetchNextPage();
  }, [items, queue, requestedId, responseTarget]);

  const decline = useMutation({
    mutationFn: () => declinePeekRequest({ requestId: declineTarget.requestId, reason: declineReason.trim() }),
    onSuccess: () => {
      setDeclineTarget(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['seller-peek-request-queue'] });
      queryClient.invalidateQueries({ queryKey: ['peek-threads'] });
      toast.success('Peek Request declined');
    },
    onError: (error) => toast.error(error.message || 'Unable to decline this request'),
  });

  const openResponse = (item) => {
    setResponseDraft(null);
    setResponseTarget(item);
    const next = new URLSearchParams(searchParams);
    next.set('request', item.requestId);
    setSearchParams(next, { replace: true });
  };

  const closeResponse = () => {
    if (responseBusy || bindingBusy) return;
    if (responseDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(responseDraft.previewUrl);
    setResponseDraft(null);
    setResponseTarget(null);
    const next = new URLSearchParams(searchParams);
    next.delete('request');
    setSearchParams(next, { replace: true });
  };

  const completeResponseUpload = async (result) => {
    if (!responseTarget?.requestId || !result?.tourId) return;
    setBindingBusy(true);
    try {
      await queueResponsePeekBinding(result.tourId, responseTarget.requestId);
      toast.success('Response Peek uploaded. It will answer this request automatically after approval.');
      queryClient.invalidateQueries({ queryKey: ['seller-peek-request-queue'] });
      queryClient.invalidateQueries({ queryKey: ['peek-threads'] });
      closeResponse();
    } catch (error) {
      toast.error(error.message || 'The Response Peek uploaded but could not be attached to this request.');
    } finally {
      setBindingBusy(false);
    }
  };

  return (
    <section className="mx-4 mb-5 overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="buyer-peek-requests-heading">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Seller evidence queue</p>
          <h2 id="buyer-peek-requests-heading" className="mt-1 text-lg font-black">Buyer Peek Requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Prioritised by buyer interest and how long each request has waited.</p>
        </div>
        {items.length > 0 && <Badge variant="secondary">{items.length} loaded</Badge>}
      </div>

      {queue.isLoading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading requests</div>
      ) : queue.isError ? (
        <div className="p-6 text-center"><p className="text-sm text-destructive">Buyer Peek Requests could not be loaded.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => queue.refetch()}>Try again</Button></div>
      ) : items.length === 0 ? (
        <div className="p-7 text-center"><MessageSquareMore className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">No pending Peek Requests</p><p className="mt-1 text-sm text-muted-foreground">New buyer requests across your live listings will appear here.</p></div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <article key={item.requestId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{peekRequestCategoryLabel(item.category)}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Users className="h-3.5 w-3.5" />{item.supporterCount} interested</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{waitingLabel(item.pendingSeconds)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-5">{item.body}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.parentTitle}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link to={`${parentPath(item)}#peek-threads`}><Eye className="mr-2 h-4 w-4" />View listing</Link></Button>
                <Button size="sm" onClick={() => openResponse(item)}><Camera className="mr-2 h-4 w-4" />Record response</Button>
                <Button size="sm" variant="ghost" onClick={() => { setDeclineTarget(item); setDeclineReason(''); }}><XCircle className="mr-2 h-4 w-4" />Decline</Button>
              </div>
            </article>
          ))}
          {queue.hasNextPage && <div className="flex justify-center p-4"><Button variant="outline" disabled={queue.isFetchingNextPage} onClick={() => queue.fetchNextPage()}>{queue.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</> : 'Load more requests'}</Button></div>}
        </div>
      )}

      <Dialog open={Boolean(responseTarget)} onOpenChange={(open) => { if (!open) closeResponse(); }}>
        <DialogContent className="max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top))-max(1rem,env(safe-area-inset-bottom)))] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record Response Peek</DialogTitle>
            <DialogDescription>
              {responseTarget ? `Answer “${responseTarget.body}” for ${responseTarget.parentTitle}. FindIt will attach the approved video to this request automatically.` : 'Record visual evidence for this buyer request.'}
            </DialogDescription>
          </DialogHeader>
          {responseTarget && (
            <TourUploader
              parentType={responseTarget.parentType}
              parentId={responseTarget.parentId}
              peekKind="response"
              category={responseTarget.category}
              value={responseDraft}
              onChange={setResponseDraft}
              disabled={bindingBusy}
              onBusyChange={setResponseBusy}
              onUploaded={completeResponseUpload}
            />
          )}
          {(bindingBusy || responseBusy) && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Finishing the Response Peek…</p>}
          <p className="text-xs leading-5 text-muted-foreground">The request remains pending while the video is processed and moderated. It becomes answered automatically after approval.</p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(declineTarget)} onOpenChange={(open) => { if (!open && !decline.isPending) setDeclineTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this Peek Request?</AlertDialogTitle>
            <AlertDialogDescription>Give buyers a short, useful reason. The request will no longer appear publicly as pending.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-sm font-semibold" htmlFor="peek-decline-reason">Reason</label>
          <textarea id="peek-decline-reason" autoFocus value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} maxLength={280} rows={3} className="w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="For example: the vehicle is stored off-site until Friday" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decline.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={declineReason.trim().length < 4 || decline.isPending} onClick={(event) => { event.preventDefault(); decline.mutate(); }}>
              {decline.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Declining</> : 'Decline request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
