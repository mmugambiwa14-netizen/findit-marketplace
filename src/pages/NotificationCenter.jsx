import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Film,
  Loader2,
  MessageSquareMore,
  ShieldCheck,
  UserRoundCog,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { goBackOrHome } from '@/lib/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import {
  getNotificationsPage,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationsService';

const PAGE_SIZE = 50;
const NOTIFICATION_REFRESH_MS = 30_000;
const DEFAULT_STYLE = { label: 'Account update', icon: Bell, className: 'text-primary' };
const EVENT_STYLE = {
  listing_approved: { label: 'Listing published', icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  listing_rejected: { label: 'Listing unavailable', icon: XCircle, className: 'text-destructive' },
  listing_expires_soon: { label: 'Expiry reminder', icon: Clock3, className: 'text-amber-600 dark:text-amber-400' },
  report_resolved: { label: 'Report resolved', icon: ShieldCheck, className: 'text-blue-600 dark:text-blue-400' },
  account_status: { label: 'Account update', icon: UserRoundCog, className: 'text-primary' },
  tour_ready: { label: 'Peek ready', icon: Film, className: 'text-green-600 dark:text-green-400' },
  tour_failed: { label: 'Peek failed', icon: AlertCircle, className: 'text-destructive' },
  tour_rejected: { label: 'Peek unavailable', icon: XCircle, className: 'text-destructive' },
  listing_status_changed: { label: 'Listing update', icon: Clock3, className: 'text-primary' },
  saved_listing_unavailable: { label: 'Saved listing update', icon: AlertCircle, className: 'text-amber-600 dark:text-amber-400' },
  peek_request_created: { label: 'New Peek Request', icon: MessageSquareMore, className: 'text-primary' },
  peek_request_answered: { label: 'Peek Request answered', icon: Film, className: 'text-green-600 dark:text-green-400' },
};

function markPageRead(page, notificationId = null, readAt = new Date().toISOString()) {
  if (!page || !Array.isArray(page.items)) return page;
  let changed = false;
  const items = page.items.map((item) => {
    if (item.is_read || (notificationId && item.id !== notificationId)) return item;
    changed = true;
    return { ...item, is_read: true, read_at: item.read_at || readAt };
  });
  return changed ? { ...page, items } : page;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const request = useMemo(() => ({ eventType: 'all', unreadOnly: false, limit: PAGE_SIZE }), []);
  const historyKey = useMemo(() => ['notifications', 'pages', user?.id, request], [request, user?.id]);
  const tailKey = useMemo(() => ['notifications', 'tail', user?.id], [user?.id]);
  const unreadKey = useMemo(() => ['notifications', 'unread-count', user?.id], [user?.id]);

  const notificationsQuery = useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam, signal }) => getNotificationsPage({ ...request, cursor: pageParam || null }, signal),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const tailQuery = useQuery({
    queryKey: tailKey,
    queryFn: ({ signal }) => getNotificationsPage(request, signal),
    enabled: Boolean(user?.id && notificationsQuery.data),
    staleTime: 15_000,
    refetchInterval: NOTIFICATION_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const unreadQuery = useQuery({
    queryKey: unreadKey,
    queryFn: ({ signal }) => getUnreadNotificationCount(signal),
    enabled: Boolean(user?.id),
    staleTime: 10_000,
    refetchInterval: NOTIFICATION_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    const incomingItems = Array.isArray(tailQuery.data?.items) ? tailQuery.data.items : [];
    const firstHistoryPage = notificationsQuery.data?.pages?.[0];
    const historyItems = Array.isArray(firstHistoryPage?.items) ? firstHistoryPage.items : [];
    if (!incomingItems.length) return;

    if (!historyItems.length) {
      if (firstHistoryPage) {
        queryClient.setQueryData(historyKey, {
          pages: [tailQuery.data],
          pageParams: [null],
        });
      }
      return;
    }

    const historyIds = new Set(historyItems.map((item) => item.id));
    const overlaps = incomingItems.some((item) => historyIds.has(item.id));
    if (overlaps) return;

    queryClient.setQueryData(historyKey, {
      pages: [tailQuery.data],
      pageParams: [null],
    });
  }, [historyKey, notificationsQuery.data, queryClient, tailQuery.data]);

  const items = useMemo(() => {
    const byId = new Map();
    for (const item of tailQuery.data?.items || []) byId.set(item.id, item);
    for (const page of notificationsQuery.data?.pages || []) {
      for (const item of page.items) {
        if (!byId.has(item.id)) byId.set(item.id, item);
      }
    }
    return [...byId.values()];
  }, [notificationsQuery.data, tailQuery.data]);

  const updateReadCaches = (notificationId = null) => {
    const readAt = new Date().toISOString();
    const history = /** @type {any} */ (queryClient.getQueryData(historyKey));
    if (history?.pages?.length) {
      queryClient.setQueryData(historyKey, {
        ...history,
        pages: history.pages.map((page) => markPageRead(page, notificationId, readAt)),
      });
    }

    const tail = /** @type {any} */ (queryClient.getQueryData(tailKey));
    if (tail) queryClient.setQueryData(tailKey, markPageRead(tail, notificationId, readAt));

    const currentUnread = Number(queryClient.getQueryData(unreadKey)) || 0;
    queryClient.setQueryData(unreadKey, notificationId ? Math.max(0, currentUnread - 1) : 0);
  };

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_result, notificationId) => updateReadCaches(notificationId),
    onError: (failure) => toast.error(failure.message),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      updateReadCaches();
      toast.success('All notifications marked as read');
    },
    onError: (failure) => toast.error(failure.message),
  });

  const openNotification = (item) => {
    if (!item.is_read) markRead.mutate(item.id);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => goBackOrHome(navigate, '/')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div><h1 className="font-bold text-lg">Notifications</h1><p className="text-xs text-muted-foreground">Important account and marketplace updates only</p></div>
          </div>
          {(unreadQuery.data ?? 0) > 0 && (
            <Button variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>
      </header>

      {notificationsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16" role="status" aria-label="Loading notifications"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /></div>
      ) : notificationsQuery.isError && items.length === 0 ? (
        <div className="mx-4 mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert"><p className="font-medium">We could not load notifications</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p><Button className="mt-4" variant="outline" onClick={() => notificationsQuery.refetch()}>Try again</Button></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center text-muted-foreground"><Bell className="mb-3 h-12 w-12 stroke-1" /><p className="font-medium">No notifications yet</p><p className="mt-1 max-w-sm text-sm">PeekaListing only sends essential listing, Peek, report and account updates.</p></div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {items.map((item) => {
              const style = EVENT_STYLE[item.event_type] || DEFAULT_STYLE;
              const Icon = style.icon;
              return (
                <button key={item.id} type="button" onClick={() => openNotification(item)} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${!item.is_read ? 'bg-primary/5' : ''}`}>
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted ${style.className}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{style.label}</span><span className={`mt-0.5 block text-sm ${!item.is_read ? 'font-semibold' : 'font-medium'}`}>{item.title}</span></span>{!item.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</span><span className="mt-1 block text-sm text-muted-foreground">{item.message}</span><span className="mt-1.5 block text-xs text-muted-foreground/70">{formatDistanceToNow(new Date(item.created_date), { addSuffix: true })}</span></span>
                </button>
              );
            })}
          </div>
          {notificationsQuery.hasNextPage && (
            <div className="p-4 text-center"><Button variant="outline" disabled={notificationsQuery.isFetchingNextPage} onClick={() => notificationsQuery.fetchNextPage()}>{notificationsQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more notifications'}</Button></div>
          )}
          {!notificationsQuery.hasNextPage && items.length > 0 && <p className="p-4 text-center text-xs text-muted-foreground">You have reached the end of your notifications.</p>}
          {notificationsQuery.isFetchNextPageError && items.length > 0 && <div className="p-4 text-center"><Button variant="outline" onClick={() => notificationsQuery.fetchNextPage()}>Retry loading more</Button></div>}
        </>
      )}
    </div>
  );
}
