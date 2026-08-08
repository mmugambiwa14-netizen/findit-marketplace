import { useDeferredValue, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Loader2, MessageCircle, Play, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import RealtimeConversationThread from '@/components/messaging/RealtimeConversationThread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { formatInboxTimestamp } from '@/lib/messageTimestamps';
import { getMessageInboxPage } from '@/services/messagingService';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;
const INBOX_REFRESH_MS = 10_000;

function statusLabel(status) {
  return {
    available: 'Available', under_offer: 'Under offer', sold: 'Sold', rented: 'Rented', hired: 'Hired',
    expired: 'Expired', paused: 'Paused', unavailable: 'Unavailable',
  }[status] || String(status || 'Unavailable').replaceAll('_', ' ');
}

function durationLabel(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`;
}

export default function Inquiries() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const request = useMemo(() => ({ query: deferredSearch, unreadOnly, limit: PAGE_SIZE }), [deferredSearch, unreadOnly]);

  const inboxQuery = useInfiniteQuery({
    queryKey: ['message-inbox', request],
    queryFn: ({ pageParam, signal }) => getMessageInboxPage({ ...request, cursor: pageParam || null }, signal),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id) && !conversationId,
    staleTime: 15_000,
    refetchInterval: INBOX_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const conversations = useMemo(() => {
    const byId = new Map();
    for (const page of inboxQuery.data?.pages || []) for (const item of page.items) byId.set(item.conversation_id, item);
    return [...byId.values()];
  }, [inboxQuery.data]);

  if (conversationId) return <RealtimeConversationThread conversationId={conversationId} currentUser={user} onBack={() => navigate('/chats')} />;

  return (
    <div className="findit-screen">
      <header className="locked-page-header">
        <div className="mx-auto flex min-h-[76px] max-w-3xl items-center gap-3.5 px-4 py-4 sm:py-3.5">
          <button type="button" onClick={() => navigate('/profile')} aria-label="Back to profile" className="clay-icon h-11 w-11"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-primary">PeekaListing inbox</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.025em]">Chats</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="message-inbox-search" className="sr-only">Search chats</label>
            <Input id="message-inbox-search" className="locked-control h-12 rounded-2xl pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats or listings" maxLength={100} />
          </div>
          <button type="button" onClick={() => setUnreadOnly((value) => !value)} aria-pressed={unreadOnly} className={cn('locked-control h-12 rounded-2xl px-3 text-xs font-bold text-muted-foreground', unreadOnly && 'border-primary/50 bg-primary/10 text-primary')}>{unreadOnly ? 'Unread' : 'All'}</button>
        </div>

        {inboxQuery.isError && <section className="clay-card mt-5 rounded-2xl p-6 text-center"><h2 className="font-bold">We could not load your chats</h2><p className="mt-2 text-sm text-muted-foreground">Your search is preserved. Check your connection and try again.</p><Button type="button" variant="outline" className="clay-control mt-4" onClick={() => inboxQuery.refetch()}>Try again</Button></section>}

        {inboxQuery.isLoading ? (
          <div className="flex justify-center py-20" aria-label="Loading chats"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
        ) : !inboxQuery.isError && conversations.length === 0 ? (
          <section className="py-20 text-center text-muted-foreground">
            <span className="locked-icon-tile mx-auto h-16 w-16"><MessageCircle className="h-7 w-7" /></span>
            <h2 className="mt-5 text-lg font-bold text-foreground">{unreadOnly || deferredSearch ? 'No matching chats' : 'No chats yet'}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6">{unreadOnly || deferredSearch ? 'Change the search or show all conversations.' : 'Open a listing and message the seller to start a private conversation.'}</p>
            {!unreadOnly && !deferredSearch && <Button type="button" className="clay-button mt-5" onClick={() => navigate('/search')}>Browse listings</Button>}
          </section>
        ) : !inboxQuery.isError && (
          <section className="mt-5 space-y-2.5" aria-label="Chat conversations">
            {conversations.map((conversation) => <ConversationRow key={conversation.conversation_id} conversation={conversation} onOpen={() => navigate(`/chats/${conversation.conversation_id}`)} />)}
            {inboxQuery.hasNextPage && <div className="pt-3 text-center"><Button type="button" variant="outline" className="clay-control" disabled={inboxQuery.isFetchingNextPage} onClick={() => inboxQuery.fetchNextPage()}>{inboxQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more chats'}</Button></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function ConversationRow({ conversation, onOpen }) {
  const timestamp = formatInboxTimestamp(conversation.last_message_at);
  const { format } = useCurrency();
  const available = ['available', 'under_offer'].includes(conversation.listing_status);
  const duration = durationLabel(conversation.tour_duration_seconds);
  return (
    <button type="button" onClick={onOpen} className="locked-list-row flex min-h-24 w-full items-start gap-3 p-3.5 text-left transition hover:border-primary/25 hover:bg-card">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
        {conversation.listing_photo ? <img src={conversation.listing_photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageOff className="h-5 w-5 text-muted-foreground" /></div>}
        {conversation.has_tour && <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white"><Play className="h-2.5 w-2.5 fill-current" />{duration || 'Peek'}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><p className={cn('truncate text-sm', conversation.has_unread ? 'font-extrabold' : 'font-semibold')}>{conversation.other_user_name}</p><time dateTime={conversation.last_message_at} className="shrink-0 text-[10px] text-muted-foreground">{timestamp}</time></div>
        <div className="mt-1 flex min-w-0 items-center gap-2"><p className="truncate text-xs font-semibold text-foreground/90">{conversation.listing_title}</p>{!available && <Badge variant="destructive" className="h-5 shrink-0 px-1.5 text-[9px]">{statusLabel(conversation.listing_status)}</Badge>}</div>
        {conversation.listing_price != null && <p className="mt-1 text-xs font-extrabold text-primary">{format(conversation.listing_price)}</p>}
        <p className={cn('mt-1.5 truncate text-xs', conversation.has_unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{conversation.last_message}</p>
      </div>
      {conversation.has_unread && <span className="mt-8 h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/.7)]" aria-label="Unread" />}
    </button>
  );
}
