import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, Clock3, Eye, Loader2, MessageSquareMore, RotateCcw, Users, XCircle } from 'lucide-react';
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
import {
  acceptPeekRequest,
  cancelPeekRequestFulfilment,
  declinePeekRequest,
  getSellerPeekRequestQueue,
} from '@/services/peekThreadsService';
import { queueResponsePeekBinding } from '@/services/responsePeekBindingIntentService';

const SELLER_QUEUE_PAGE_SIZE = 20;
const SELLER_QUEUE_REFRESH_MS = 30_000;
const MAX_REQUESTED_AUTO_PAGES = 5;

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

/**
 * One row of the seller fulfilment queue, as built by normalizeSellerPeekQueuePage()
 * in src/domain/peekThreads/sellerQueueContracts.js:18-39.
 *
 * Declared here because useMutation defaults TVariables to void when it cannot
 * infer it from mutationFn, which silently turned every `item` below into void.
 *
 * @typedef {object} SellerQueueItem
 * @property {string} requestId
 * @property {string} parentType
 * @property {string} parentId
 * @property {string} parentKind
 * @property {string} parentTitle
 * @property {string} category
 * @property {string} body
 * @property {number} supporterCount
 * @property {string} createdAt
 * @property {number} pendingSeconds
 * @property {number} queueScore
 * @property {{
 *   status: string,
 *   attemptCount: number,
 *   tourId: string | null,
 *   expiresAt: string | null,
 *   failureReason: string | null,
 * } | null} fulfilment
 */

function fulfilmentLabel(status) {
  return {
    accepted: 'Accepted',
    uploading: 'Upload started',
    processing: 'Processing',
    failed: 'Needs retry',
    cancelled: 'Cancelled',
    expired: 'Expired',
  }[status] || null;
}

function updateQueuePage(page, requestId, updater) {
  if (!page || !Array.isArray(page.items)) return page;
  let changed = false;
  const items = [];
  for (const item of page.items) {
    if (item.requestId !== requestId) {
      items.push(item);
      continue;
    }
    changed = true;
    const next = updater(item);
    if (next) items.push(next);
  }
  return changed ? { ...page, items } : page;
}

export default function BuyerPeekRequestsQueue() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('request');
  const requestedAutoPagesRef = useRef(0);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [responseTarget, setResponseTarget] = useState(null);
  const [responseDraft, setResponseDraft] = useState(null);
  const [responseBusy, setResponseBusy] = useState(false);
  const [bindingBusy, setBindingBusy] = useState(false);
  const historyKey = useMemo(() => ['seller-peek-request-queue', 'pages'], []);
  const tailKey = useMemo(() => ['seller-peek-request-queue', 'tail'], []);

  const queue = useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam, signal }) => getSellerPeekRequestQueue({ cursor: pageParam || null, limit: SELLER_QUEUE_PAGE_SIZE }, signal),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor || undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const tail = useQuery({
    queryKey: tailKey,
    queryFn: ({ signal }) => getSellerPeekRequestQueue({ limit: SELLER_QUEUE_PAGE_SIZE }, signal),
    enabled: Boolean(queue.data),
    staleTime: 15_000,
    refetchInterval: SELLER_QUEUE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    const incomingItems = Array.isArray(tail.data?.items) ? tail.data.items : [];
    const firstHistoryPage = queue.data?.pages?.[0];
    const historyItems = Array.isArray(firstHistoryPage?.items) ? firstHistoryPage.items : [];
    if (!incomingItems.length) return;

    if (!historyItems.length) {
      if (firstHistoryPage) queryClient.setQueryData(historyKey, { pages: [tail.data], pageParams: [null] });
      return;
    }

    const historyIds = new Set(historyItems.map((item) => item.requestId));
    const overlaps = incomingItems.some((item) => historyIds.has(item.requestId));
    if (overlaps) return;
    queryClient.setQueryData(historyKey, { pages: [tail.data], pageParams: [null] });
  }, [historyKey, queryClient, queue.data, tail.data]);

  const items = useMemo(() => {
    const byId = new Map();
    for (const item of tail.data?.items || []) byId.set(item.requestId, item);
    for (const page of queue.data?.pages || []) {
      for (const item of page.items) {
        if (!byId.has(item.requestId)) byId.set(item.requestId, item);
      }
    }
    return [...byId.values()];
  }, [queue.data, tail.data]);

  useEffect(() => {
    requestedAutoPagesRef.current = 0;
  }, [requestedId]);

  useEffect(() => {
    if (!requestedId || responseTarget) return;
    const match = items.find((item) => item.requestId === requestedId);
    if (match && ['accepted', 'uploading'].includes(match.fulfilment?.status)) {
      setResponseDraft(null);
      setResponseTarget(match);
      return;
    }
    if (
      queue.hasNextPage
      && !queue.isFetchingNextPage
      && requestedAutoPagesRef.current < MAX_REQUESTED_AUTO_PAGES
    ) {
      requestedAutoPagesRef.current += 1;
      queue.fetchNextPage();
    }
  }, [items, queue, requestedId, responseTarget]);

  const updateQueueCaches = (requestId, updater) => {
    const history = /** @type {any} */ (queryClient.getQueryData(historyKey));
    if (history?.pages?.length) {
      queryClient.setQueryData(historyKey, {
        ...history,
        pages: history.pages.map((page) => updateQueuePage(page, requestId, updater)),
      });
    }
    const currentTail = /** @type {any} */ (queryClient.getQueryData(tailKey));
    if (currentTail) queryClient.setQueryData(tailKey, updateQueuePage(currentTail, requestId, updater));
  };

  const refreshQueueTail = () => {
    queryClient.invalidateQueries({ queryKey: tailKey, exact: true });
    queryClient.invalidateQueries({ queryKey: ['peek-threads'] });
  };

  const setFulfilmentStatus = (requestId, status) => {
    updateQueueCaches(requestId, (item) => ({
      ...item,
      fulfilment: {
        ...(item.fulfilment || {}),
        status,
        failureReason: status === 'accepted' ? null : item.fulfilment?.failureReason ?? null,
      },
    }));
  };

  const resetResponse = () => {
    if (responseDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(responseDraft.previewUrl);
    setResponseDraft(null);
    setResponseTarget(null);
    const next = new URLSearchParams(searchParams);
    next.delete('request');
    setSearchParams(next, { replace: true });
  };

  const accept = useMutation({
    mutationFn: (/** @type {SellerQueueItem} */ item) => acceptPeekRequest(item.requestId),
    onSuccess: (_result, item) => {
      setFulfilmentStatus(item.requestId, 'accepted');
      refreshQueueTail();
      toast.success(item.fulfilment?.status === 'failed' ? 'Peek Request ready to retry' : 'Peek Request accepted');
      setResponseDraft(null);
      setResponseTarget({ ...item, fulfilment: { ...(item.fulfilment || {}), status: 'accepted', failureReason: null } });
      const next = new URLSearchParams(searchParams);
      next.set('request', item.requestId);
      setSearchParams(next, { replace: true });
    },
    onError: (error) => toast.error(error.message || 'Unable to accept this request'),
  });

  const cancel = useMutation({
    mutationFn: (/** @type {SellerQueueItem} */ item) => cancelPeekRequestFulfilment(item.requestId, 'Seller cancelled the current fulfilment attempt'),
    onSuccess: (_result, item) => {
      setFulfilmentStatus(item.requestId, 'cancelled');
      setCancelTarget(null);
      resetResponse();
      refreshQueueTail();
      toast.success('Fulfilment attempt cancelled');
    },
    onError: (error) => toast.error(error.message || 'Unable to cancel this fulfilment'),
  });

  const decline = useMutation({
    mutationFn: () => declinePeekRequest({ requestId: declineTarget.requestId, reason: declineReason.trim() }),
    onSuccess: () => {
      const requestId = declineTarget?.requestId;
      if (requestId) updateQueueCaches(requestId, () => null);
      setDeclineTarget(null);
      setDeclineReason('');
      refreshQueueTail();
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
    resetResponse();
  };

  const completeResponseUpload = async (result) => {
    if (!responseTarget?.requestId || !result?.tourId) return;
    setBindingBusy(true);
    try {
      await queueResponsePeekBinding(result.tourId, responseTarget.requestId);
      setFulfilmentStatus(responseTarget.requestId, 'processing');
      toast.success('Response Peek uploaded. It will answer this request automatically once processing finishes.');
      refreshQueueTail();
      resetResponse();
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
      ) : queue.isError && items.length === 0 ? (
        <div className="p-6 text-center"><p className="text-sm text-destructive">Buyer Peek Requests could not be loaded.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => queue.refetch()}>Try again</Button></div>
      ) : items.length === 0 ? (
        <div className="p-7 text-center"><MessageSquareMore className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">No pending Peek Requests</p><p className="mt-1 text-sm text-muted-foreground">New buyer requests across your live listings will appear here.</p></div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const status = item.fulfilment?.status;
            const active = ['accepted', 'uploading', 'processing'].includes(status);
            return (
              <article key={item.requestId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{peekRequestCategoryLabel(item.category)}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Users className="h-3.5 w-3.5" />{item.supporterCount} interested</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{waitingLabel(item.pendingSeconds)}</span>
                      {fulfilmentLabel(status) && <Badge variant={status === 'failed' ? 'destructive' : 'outline'}>{fulfilmentLabel(status)}</Badge>}
                    </div>
                    <h3 className="mt-2 text-sm font-bold leading-5">{item.body}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.parentTitle}</p>
                    {item.fulfilment?.failureReason && <p className="mt-2 text-xs text-destructive">{item.fulfilment.failureReason}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link to={`${parentPath(item)}#peek-threads`}><Eye className="mr-2 h-4 w-4" />View listing</Link></Button>
                  {!status && <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate(item)}><CheckCircle2 className="mr-2 h-4 w-4" />Accept</Button>}
                  {['accepted', 'uploading'].includes(status) && <Button size="sm" onClick={() => openResponse(item)}><Camera className="mr-2 h-4 w-4" />{status === 'uploading' ? 'Continue upload' : 'Record response'}</Button>}
                  {['failed', 'cancelled', 'expired'].includes(status) && <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate(item)}><RotateCcw className="mr-2 h-4 w-4" />Retry</Button>}
                  {active && <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => setCancelTarget(item)}><XCircle className="mr-2 h-4 w-4" />Cancel attempt</Button>}
                  {!active && status !== 'processing' && <Button size="sm" variant="ghost" onClick={() => { setDeclineTarget(item); setDeclineReason(''); }}><XCircle className="mr-2 h-4 w-4" />Decline</Button>}
                </div>
              </article>
            );
          })}
          {queue.hasNextPage && <div className="flex justify-center p-4"><Button variant="outline" disabled={queue.isFetchingNextPage} onClick={() => queue.fetchNextPage()}>{queue.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</> : 'Load more requests'}</Button></div>}
          {queue.isFetchNextPageError && items.length > 0 && <div className="flex justify-center p-4"><Button variant="outline" onClick={() => queue.fetchNextPage()}>Retry loading more</Button></div>}
        </div>
      )}

      <Dialog open={Boolean(responseTarget)} onOpenChange={(open) => { if (!open) closeResponse(); }}>
        <DialogContent className="max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top))-max(1rem,env(safe-area-inset-bottom)))] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record Response Peek</DialogTitle>
            <DialogDescription>
              {responseTarget ? `Answer “${responseTarget.body}” for ${responseTarget.parentTitle}. PeekaListing attaches the video to this request automatically once it finishes processing.` : 'Record visual evidence for this buyer request.'}
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
          <p className="text-xs leading-5 text-muted-foreground">The accepted request stays open while the video uploads and processes. It becomes answered automatically as soon as processing finishes.</p>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open && !cancel.isPending) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this fulfilment attempt?</AlertDialogTitle>
            <AlertDialogDescription>The buyer request stays open, but the current upload or processing attempt will no longer be attached automatically. You can retry later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Keep attempt</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isPending} onClick={(event) => { event.preventDefault(); cancel.mutate(cancelTarget); }}>
              {cancel.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling</> : 'Cancel attempt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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