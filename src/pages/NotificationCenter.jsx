import { useMemo } from 'react';
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
  ShieldCheck,
  UserRoundCog,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
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
const DEFAULT_STYLE = { label: 'Account update', icon: Bell, className: 'text-primary' };
const EVENT_STYLE = {
  listing_approved: { label: 'Listing approved', icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  listing_rejected: { label: 'Listing rejected', icon: XCircle, className: 'text-destructive' },
  listing_expires_soon: { label: 'Expiry reminder', icon: Clock3, className: 'text-amber-600 dark:text-amber-400' },
  report_resolved: { label: 'Report resolved', icon: ShieldCheck, className: 'text-blue-600 dark:text-blue-400' },
  account_status: { label: 'Account update', icon: UserRoundCog, className: 'text-primary' },
  tour_ready: { label: 'Tour ready', icon: Film, className: 'text-green-600 dark:text-green-400' },
  tour_failed: { label: 'Tour failed', icon: AlertCircle, className: 'text-destructive' },
  tour_rejected: { label: 'Tour rejected', icon: XCircle, className: 'text-destructive' },
  listing_status_changed: { label: 'Listing update', icon: Clock3, className: 'text-primary' },
  saved_listing_unavailable: { label: 'Saved listing update', icon: AlertCircle, className: 'text-amber-600 dark:text-amber-400' },
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const request = useMemo(() => ({ eventType: 'all', unreadOnly: false, limit: PAGE_SIZE }), []);

  const notificationsQuery = useInfiniteQuery({
    queryKey: ['notifications', 'pages', user?.id, request],
    queryFn: ({ pageParam }) => getNotificationsPage({ ...request, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id),
    staleTime: 15_000,
  });
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  });

  const items = useMemo(() => {
    const byId = new Map();
    for (const page of notificationsQuery.data?.pages || []) {
      for (const item of page.items) byId.set(item.id, item);
    }
    return [...byId.values()];
  }, [notificationsQuery.data]);

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidateNotifications,
    onError: (failure) => toast.error(failure.message),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      invalidateNotifications();
      toast.success('All notifications marked as read');
    },
    onError: (failure) => toast.error(failure.message),
  });

  const openNotification = (item) => {
    if (!item.is_read) markRead.mutate(item.id);
    if (item.link) navigate(item.link);
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted" aria-label="Go back">
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
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center text-muted-foreground"><Bell className="mb-3 h-12 w-12 stroke-1" /><p className="font-medium">No notifications yet</p><p className="mt-1 max-w-sm text-sm">FindIt only sends essential listing, Tour, report and account updates.</p></div>
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
          {notificationsQuery.isError && items.length > 0 && <div className="p-4 text-center"><Button variant="outline" onClick={() => notificationsQuery.refetch()}>Retry loading more</Button></div>}
        </>
      )}
    </div>
  );
}
