import { useDeferredValue, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Loader2, MessageSquare, Play, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationThread from '@/components/messaging/ConversationThread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { formatInboxTimestamp } from '@/lib/messageTimestamps';
import { getMessageInboxPage } from '@/services/messagingService';

const PAGE_SIZE = 30;

function statusLabel(status) {
  return {
    available: 'Available',
    under_offer: 'Under offer',
    sold: 'Sold',
    rented: 'Rented',
    hired: 'Hired',
    expired: 'Expired',
    paused: 'Paused',
    unavailable: 'Unavailable',
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
    queryFn: ({ pageParam }) => getMessageInboxPage({ ...request, cursor: pageParam || null }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(user?.id) && !conversationId,
    staleTime: 15_000,
  });

  const conversations = useMemo(() => {
    const byId = new Map();
    for (const page of inboxQuery.data?.pages || []) {
      for (const item of page.items) byId.set(item.conversation_id, item);
    }
    return [...byId.values()];
  }, [inboxQuery.data]);

  if (conversationId) {
    return <ConversationThread conversationId={conversationId} currentUser={user} onBack={() => navigate('/chats')} />;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/profile')} aria-label="Back to profile"><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-lg font-bold">Chats</h1><p className="text-xs text-muted-foreground">Private conversations about FindIt listings</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="message-inbox-search" className="sr-only">Search messages</label>
            <Input id="message-inbox-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search person or listing" maxLength={100} />
          </div>
          <Button type="button" variant={unreadOnly ? 'default' : 'outline'} onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? 'Showing unread' : 'Unread only'}</Button>
        </div>

        {inboxQuery.isError && <div className="mt-5 rounded-xl border bg-card p-6 text-center"><h2 className="font-semibold">We could not load your messages</h2><p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="mt-4" onClick={() => inboxQuery.refetch()}>Try again</Button></div>}

        {inboxQuery.isLoading ? (
          <div className="flex justify-center py-16" aria-label="Loading messages"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
        ) : !inboxQuery.isError && conversations.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 stroke-1" />
            <p className="font-medium text-foreground">{unreadOnly || deferredSearch ? 'No messages match' : 'No messages yet'}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm">{unreadOnly || deferredSearch ? 'Try changing your search or unread filter.' : 'Use Message seller on a listing to start a private conversation.'}</p>
            {!unreadOnly && !deferredSearch && <Button type="button" className="mt-5" onClick={() => navigate('/search')}>Browse listings</Button>}
          </div>
        ) : !inboxQuery.isError && (
          <div className="mt-5 overflow-hidden rounded-xl border bg-card">
            <div className="divide-y">{conversations.map((conversation) => <ConversationRow key={conversation.conversation_id} conversation={conversation} onOpen={() => navigate(`/chats/${conversation.conversation_id}`)} />)}</div>
            {inboxQuery.hasNextPage && <div className="border-t p-3 text-center"><Button type="button" variant="outline" disabled={inboxQuery.isFetchingNextPage} onClick={() => inboxQuery.fetchNextPage()}>{inboxQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load more chats'}</Button></div>}
          </div>
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
    <button type="button" onClick={onOpen} className="flex min-h-24 w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50">
      <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
        {conversation.listing_photo ? <img src={conversation.listing_photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageOff className="h-5 w-5 text-muted-foreground" /></div>}
        {conversation.has_tour && <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white"><Play className="h-2.5 w-2.5 fill-current" />{duration || 'Peek'}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><p className={conversation.has_unread ? 'truncate text-sm font-bold' : 'truncate text-sm font-medium'}>{conversation.other_user_name}</p><time dateTime={conversation.last_message_at} className="shrink-0 text-[11px] text-muted-foreground">{timestamp}</time></div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2"><p className="truncate text-xs font-medium text-foreground">{conversation.listing_title}</p>{!available && <Badge variant="destructive" className="h-5 shrink-0 px-1.5 text-[9px]">{statusLabel(conversation.listing_status)}</Badge>}</div>
        {conversation.listing_price != null && <p className="mt-0.5 text-xs font-semibold text-primary">{format(conversation.listing_price)}</p>}
        <p className={conversation.has_unread ? 'mt-1 truncate text-xs font-medium text-foreground' : 'mt-1 truncate text-xs text-muted-foreground'}>{conversation.last_message}</p>
      </div>
      {conversation.has_unread && <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </button>
  );
}
