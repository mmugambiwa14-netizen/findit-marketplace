import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Eye, Loader2, MessageSquareMore, ThumbsUp, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ResponsePeekWatchButton from '@/components/peekThreads/ResponsePeekWatchButton';
import { peekRequestCategoryLabel } from '@/domain/peekThreads/categories';
import { useAuth } from '@/lib/AuthContext';
import { getMyPeekRequestActivityPage, withdrawPeekRequestSupport } from '@/services/peekThreadsService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const ACTIVITY_PAGE_SIZE = 20;
const ACTIVITY_REFRESH_MS = 30_000;

function parentPath(item) {
  if (item.parentType === 'service') return `/service/${item.parentId}`;
  if (item.parentKind === 'car') return `/car/${item.parentId}`;
  if (item.parentKind === 'machinery') return `/machinery/${item.parentId}`;
  return `/property/${item.parentId}`;
}

function requestStatus(item) {
  if (item.status === 'answered' && item.currentResponseId) {
    return { label: 'Answered', icon: CheckCircle2, className: 'bg-success/15 text-success' };
  }
  if (item.status === 'declined') {
    return { label: 'Declined', icon: XCircle, className: 'bg-destructive/10 text-destructive' };
  }
  if (item.status === 'expired') {
    return { label: 'Expired', icon: Clock3, className: 'bg-muted text-muted-foreground' };
  }
  return { label: 'Awaiting response', icon: Clock3, className: '' };
}

function removeRequestFromPage(page, requestId) {
  if (!page || !Array.isArray(page.items)) return page;
  const items = page.items.filter((item) => item.requestId !== requestId);
  return items.length === page.items.length ? page : { ...page, items };
}

export default function MyPeekRequestsQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const historyKey = useMemo(() => ['peek-request-activity', user?.id ?? null, 'pages'], [user?.id]);
  const tailKey = useMemo(() => ['peek-request-activity', user?.id ?? null, 'tail'], [user?.id]);

  const activity = useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam, signal }) => getMyPeekRequestActivityPage({ cursor: pageParam || null, limit: ACTIVITY_PAGE_SIZE }, signal),
    enabled: Boolean(user?.id),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor || undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const tail = useQuery({
    queryKey: tailKey,
    queryFn: ({ signal }) => getMyPeekRequestActivityPage({ limit: ACTIVITY_PAGE_SIZE }, signal),
    enabled: Boolean(user?.id && activity.data),
    staleTime: 15_000,
    refetchInterval: ACTIVITY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    const incomingItems = Array.isArray(tail.data?.items) ? tail.data.items : [];
    const firstHistoryPage = activity.data?.pages?.[0];
    const historyItems = Array.isArray(firstHistoryPage?.items) ? firstHistoryPage.items : [];
    if (!incomingItems.length) return;

    if (!historyItems.length) {
      if (firstHistoryPage) {
        queryClient.setQueryData(historyKey, { pages: [tail.data], pageParams: [null] });
      }
      return;
    }

    const historyIds = new Set(historyItems.map((item) => item.requestId));
    const overlaps = incomingItems.some((item) => historyIds.has(item.requestId));
    if (overlaps) return;
    queryClient.setQueryData(historyKey, { pages: [tail.data], pageParams: [null] });
  }, [activity.data, historyKey, queryClient, tail.data]);

  const items = useMemo(() => {
    const byId = new Map();
    for (const item of tail.data?.items || []) byId.set(item.requestId, item);
    for (const page of activity.data?.pages || []) {
      for (const item of page.items) {
        if (!byId.has(item.requestId)) byId.set(item.requestId, item);
      }
    }
    return [...byId.values()];
  }, [activity.data, tail.data]);

  const removeRequestFromCaches = (requestId) => {
    const history = /** @type {any} */ (queryClient.getQueryData(historyKey));
    if (history?.pages?.length) {
      queryClient.setQueryData(historyKey, {
        ...history,
        pages: history.pages.map((page) => removeRequestFromPage(page, requestId)),
      });
    }
    const currentTail = /** @type {any} */ (queryClient.getQueryData(tailKey));
    if (currentTail) queryClient.setQueryData(tailKey, removeRequestFromPage(currentTail, requestId));
  };

  const withdraw = useMutation({
    mutationFn: (requestId) => withdrawPeekRequestSupport(requestId),
    onSuccess: (_result, requestId) => {
      removeRequestFromCaches(requestId);
      queryClient.invalidateQueries({ queryKey: tailKey, exact: true });
      queryClient.invalidateQueries({ queryKey: ['peek-threads'] });
      toast.success('Interest removed from this Peek Request');
    },
    onError: (error) => toast.error(error.message || 'Unable to remove your interest'),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="my-peek-requests-heading">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Buyer activity</p>
          <h2 id="my-peek-requests-heading" className="mt-1 text-lg font-black">My requests</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Track visual evidence you requested or supported across the marketplace.</p>
        </div>
        {items.length > 0 && <Badge variant="secondary">Showing {items.length}</Badge>}
      </div>

      {activity.isLoading ? (
        <ListRowsSkeleton rows={5} className="p-3" label="Loading your Peek Requests" />
      ) : activity.isError && items.length === 0 ? (
        <div className="p-7 text-center"><p className="text-sm text-destructive">Your Peek Requests could not be loaded.</p><Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => activity.refetch()}>Try again</Button></div>
      ) : items.length === 0 ? (
        <div className="p-9 text-center">
          <MessageSquareMore className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No Peek Requests yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Open a listing and request visual proof, or support an existing request that matters to you.</p>
          <Button asChild type="button" variant="outline" className="mt-4"><Link to="/search">Browse listings</Link></Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const status = requestStatus(item);
            const StatusIcon = status.icon;
            const answered = item.status === 'answered' && item.currentResponseId;
            const canWithdraw = item.status === 'pending' && item.supportedByMe && !item.requestedByMe;
            return (
              <article key={item.requestId} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{peekRequestCategoryLabel(item.category)}</Badge>
                  <Badge variant="outline">{item.requestedByMe ? 'Requested by you' : 'You are interested'}</Badge>
                  <Badge className={status.className} variant={status.className ? 'secondary' : 'outline'}><StatusIcon className="mr-1 h-3.5 w-3.5" />{status.label}</Badge>
                </div>
                <h3 className="mt-3 text-base font-bold leading-6">{item.body}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{item.parentTitle}</span>
                  <span>{item.supporterCount === 1 ? '1 buyer interested' : `${item.supporterCount} buyers interested`}</span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
                </div>

                {item.status === 'declined' && item.declineReason && (
                  <div className="mt-4 rounded-xl border border-destructive/15 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold">Seller response</p>
                    <p className="mt-1 leading-6 text-muted-foreground">{item.declineReason}</p>
                  </div>
                )}

                {answered && (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-success/20 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Response Peek available</p>
                      <p className="mt-1 text-xs text-muted-foreground">The seller published visual evidence for this request.</p>
                    </div>
                    <ResponsePeekWatchButton tourId={item.currentResponseId} title={item.body} />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.parentPublic ? (
                    <Button asChild type="button" size="sm" variant="outline"><Link to={`${parentPath(item)}#peek-threads`}><Eye className="mr-2 h-4 w-4" />View listing</Link></Button>
                  ) : (
                    <span className="inline-flex min-h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-xs font-semibold text-muted-foreground">Listing no longer public</span>
                  )}
                  {canWithdraw && (
                    <Button type="button" size="sm" variant="ghost" disabled={withdraw.isPending} onClick={() => withdraw.mutate(item.requestId)}>
                      <ThumbsUp className="mr-2 h-4 w-4" />Remove interest
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
          {activity.hasNextPage && (
            <div className="flex justify-center p-4">
              <Button type="button" variant="outline" disabled={activity.isFetchingNextPage} onClick={() => activity.fetchNextPage()}>
                {activity.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</> : 'Load more requests'}
              </Button>
            </div>
          )}
          {activity.isFetchNextPageError && items.length > 0 && (
            <div className="flex justify-center p-4"><Button type="button" variant="outline" onClick={() => activity.fetchNextPage()}>Retry loading more</Button></div>
          )}
        </div>
      )}
    </section>
  );
}
