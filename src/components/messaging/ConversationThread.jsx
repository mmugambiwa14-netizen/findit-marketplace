import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, EllipsisVertical, ExternalLink, Flag, ImageOff, Loader2, MessageSquareText, Play, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import { ConversationThreadSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  getMessageConversationMetadata,
  getMessageThreadPage,
  markConversationSeen,
  reportMessageConversation,
  sendConversationMessage,
  setConversationBlocked,
} from '@/services/messagingService';

const THREAD_PAGE_SIZE = 50;
const DISCONNECTED_THREAD_REFRESH_MS = 4000;
const CONNECTED_THREAD_REFRESH_MS = 15_000;
const listingPath = (conversation, tour = false) => `/${conversation.listing_kind}/${conversation.listing_id}${tour ? '?media=tour' : ''}`;

function statusLabel(status) {
  return {
    available: 'Available', under_offer: 'Under offer', sold: 'Sold', rented: 'Rented',
    hired: 'Hired', expired: 'Expired', paused: 'Paused', unavailable: 'Unavailable',
  }[status] || String(status || 'Unavailable').replaceAll('_', ' ');
}

function durationLabel(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  return `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, '0')}`;
}

export default function ConversationThread({ conversationId, currentUser, onBack, realtimeConnected = false }) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const scrollRef = useRef(null);
  const firstScrollRef = useRef(true);
  const scrollAfterSendRef = useRef(false);
  const olderScrollRef = useRef(null);
  const lastSeenMessageRef = useRef(null);
  const [text, setText] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('scam');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    firstScrollRef.current = true;
    scrollAfterSendRef.current = false;
    olderScrollRef.current = null;
    lastSeenMessageRef.current = null;
    setText('');
    setBlockOpen(false);
    setReportOpen(false);
    setReportDetails('');
  }, [conversationId]);

  const conversationQuery = useQuery({
    queryKey: ['message-conversation-metadata', conversationId],
    queryFn: ({ signal }) => getMessageConversationMetadata(conversationId, signal),
    enabled: Boolean(conversationId && currentUser?.id),
    staleTime: 15_000,
    refetchOnWindowFocus: 'always',
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ['message-thread', conversationId],
    queryFn: ({ pageParam, signal }) => getMessageThreadPage(conversationId, { cursor: pageParam || null, limit: THREAD_PAGE_SIZE }, signal),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(conversationId && currentUser?.id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const tailQuery = useQuery({
    queryKey: ['message-thread-tail', conversationId],
    queryFn: ({ signal }) => getMessageThreadPage(conversationId, { limit: THREAD_PAGE_SIZE }, signal),
    enabled: Boolean(conversationId && currentUser?.id && messagesQuery.data),
    staleTime: 2_000,
    refetchInterval: realtimeConnected ? CONNECTED_THREAD_REFRESH_MS : DISCONNECTED_THREAD_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  useEffect(() => {
    const incomingPage = tailQuery.data;
    const incomingItems = Array.isArray(incomingPage?.items) ? incomingPage.items : [];
    if (!incomingItems.length) return;

    queryClient.setQueryData(['message-thread', conversationId], (currentValue) => {
      const current = /** @type {any} */ (currentValue);
      if (!current?.pages?.length) return current;
      const firstPage = current.pages[0];
      const currentItems = Array.isArray(firstPage?.items) ? firstPage.items : [];
      if (!currentItems.length) {
        return { ...current, pages: [incomingPage, ...current.pages.slice(1)] };
      }

      const currentIds = new Set(currentItems.map((item) => item.message_id));
      const overlaps = incomingItems.some((item) => currentIds.has(item.message_id));
      if (!overlaps) {
        firstScrollRef.current = true;
        olderScrollRef.current = null;
        return { ...current, pages: [incomingPage], pageParams: [null] };
      }

      const mergedItems = [...currentItems];
      let changed = false;
      for (const item of incomingItems) {
        if (currentIds.has(item.message_id)) continue;
        currentIds.add(item.message_id);
        mergedItems.push(item);
        changed = true;
      }
      if (!changed) return current;
      return {
        ...current,
        pages: [{ ...firstPage, items: mergedItems }, ...current.pages.slice(1)],
      };
    });
  }, [conversationId, queryClient, tailQuery.data]);

  const messages = useMemo(() => {
    const byId = new Map();
    const pages = [...(messagesQuery.data?.pages || [])].reverse();
    for (const page of pages) for (const item of page.items) byId.set(item.message_id, item);
    return [...byId.values()];
  }, [messagesQuery.data]);
  const latestMessageId = messages.at(-1)?.message_id ?? null;

  useEffect(() => {
    if (!conversationQuery.data || !messagesQuery.data || !latestMessageId) return;
    if (lastSeenMessageRef.current === latestMessageId) return;
    lastSeenMessageRef.current = latestMessageId;
    markConversationSeen(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['message-inbox'] }))
      .catch(() => { lastSeenMessageRef.current = null; });
  }, [conversationId, conversationQuery.data, latestMessageId, messagesQuery.data, queryClient]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !messages.length) return;
    if (olderScrollRef.current) {
      const { height, top } = olderScrollRef.current;
      container.scrollTop = container.scrollHeight - height + top;
      olderScrollRef.current = null;
      return;
    }
    if (firstScrollRef.current || scrollAfterSendRef.current) {
      firstScrollRef.current = false;
      scrollAfterSendRef.current = false;
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    }
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () => sendConversationMessage(conversationId, text),
    onSuccess: async () => {
      setText('');
      scrollAfterSendRef.current = true;
      await queryClient.refetchQueries({ queryKey: ['message-thread-tail', conversationId], exact: true, type: 'active' });
      queryClient.invalidateQueries({ queryKey: ['message-conversation-metadata', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
    },
    onError: (error) => toast.error(error.message),
  });

  const blockMutation = useMutation({
    mutationFn: (/** @type {boolean} */ blocked) => setConversationBlocked({ conversationId, blocked }),
    onSuccess: () => {
      setBlockOpen(false);
      queryClient.invalidateQueries({ queryKey: ['message-conversation-metadata', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['message-inbox'] });
      toast.success(conversationQuery.data?.blocked_by_me ? 'Conversation unblocked' : 'Conversation blocked');
    },
    onError: (error) => toast.error(error.message),
  });

  const reportMutation = useMutation({
    mutationFn: () => reportMessageConversation({ conversationId, reason: reportReason, description: reportDetails }),
    onSuccess: () => { setReportOpen(false); setReportDetails(''); toast.success('Conversation reported'); },
    onError: (error) => toast.error(error.message),
  });

  const loadOlder = async () => {
    const container = scrollRef.current;
    if (!container || !messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
    olderScrollRef.current = { height: container.scrollHeight, top: container.scrollTop };
    try {
      await messagesQuery.fetchNextPage();
    } catch {
      olderScrollRef.current = null;
    }
  };

  const loading = conversationQuery.isLoading || messagesQuery.isLoading;
  const failed = conversationQuery.isError || messagesQuery.isError;
  if (loading) return <ConversationThreadSkeleton />;
  if (failed) return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">We could not load this conversation</h1><p className="mt-2 text-sm text-muted-foreground">It may be unavailable, or you may not be a participant.</p><Button type="button" variant="outline" className="mt-5" onClick={onBack}>Back to messages</Button></div>;
  if (!conversationQuery.data) return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">Conversation not found</h1><Button type="button" variant="outline" className="mt-5" onClick={onBack}>Back to messages</Button></div>;

  const conversation = conversationQuery.data;
  const submitMessage = () => { if (text.trim() && !sendMutation.isPending) sendMutation.mutate(); };

  return (
    // 100dvh does not shrink when the on-screen keyboard opens, which left the
    // composer and its send button stranded behind the keyboard for the whole
    // time a user was typing. documentBootstrap keeps --findit-viewport-height
    // on visualViewport.height, so the panel tracks the space actually visible.
    <section className="fixed inset-0 z-30 flex h-[var(--findit-viewport-height,100dvh)] flex-col overflow-hidden bg-background">
      <header className="safe-area-top shrink-0 border-b border-border/80 bg-card/95 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-2 px-3 pb-2 pt-1.5">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to messages"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{conversation.other_user_name}</p>
              <p className="text-[10px] text-muted-foreground">Listing conversation</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Conversation options"><EllipsisVertical className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                <DropdownMenuItem className="min-h-10 rounded-lg" onSelect={() => setReportOpen(true)}><Flag className="h-4 w-4" />Report conversation</DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 rounded-lg text-destructive focus:text-destructive" onSelect={() => setBlockOpen(true)}><Ban className="h-4 w-4" />{conversation.blocked_by_me ? 'Unblock conversation' : 'Block conversation'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background/70 p-2">
            <Link to={listingPath(conversation)} className="h-12 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted" aria-label={`View ${conversation.listing_title}`}>
              {conversation.listing_photo ? <img src={conversation.listing_photo} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><ImageOff className="h-5 w-5 text-muted-foreground" /></span>}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link to={listingPath(conversation)} className="truncate text-sm font-semibold hover:text-primary">{conversation.listing_title}</Link>
                {!['available', 'under_offer'].includes(conversation.listing_status) && <Badge variant="destructive" className="h-5 shrink-0 px-1.5 text-[9px]">{statusLabel(conversation.listing_status)}</Badge>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {conversation.listing_price != null && <span className="text-xs font-bold text-primary">{format(conversation.listing_price)}</span>}
                {conversation.has_tour && <Link to={listingPath(conversation, true)} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-primary/10 px-2 text-[10px] font-semibold text-primary"><Play className="h-3 w-3 fill-current" />Peek{durationLabel(conversation.tour_duration_seconds) ? ` · ${durationLabel(conversation.tour_duration_seconds)}` : ''}</Link>}
              </div>
            </div>
            <Button asChild variant="ghost" size="icon" aria-label="View listing"><Link to={listingPath(conversation)}><ExternalLink className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="findit-scroll-region min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {messagesQuery.hasNextPage && (
            <div className="flex justify-center pb-2">
              <Button type="button" variant="outline" size="sm" disabled={messagesQuery.isFetchingNextPage} onClick={loadOlder}>
                {messagesQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load older messages'}
              </Button>
            </div>
          )}
          {messages.length === 0 && (
            <div className="mx-auto max-w-sm py-10 text-center">
              <MessageSquareText className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-bold">Start the conversation</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Ask about availability, condition, viewing, or collection. Keep payment details out of chat.</p>
            </div>
          )}
          {messages.map((message) => <MessageBubble key={message.message_id} message={message} mine={message.sender_id === currentUser.id} />)}
        </div>
      </main>

      <footer className="shrink-0 border-t border-border/80 bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto max-w-3xl">
          {conversation.can_send ? (
            <div className="flex items-end gap-2">
              <label htmlFor="conversation-message" className="sr-only">Message</label>
              <Textarea id="conversation-message" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} rows={1} maxLength={2000} enterKeyHint="send" placeholder="Write a message" className="min-h-11 max-h-28 flex-1 resize-none rounded-2xl" />
              <Button type="button" size="icon" className="h-11 w-11 shrink-0" disabled={!text.trim() || sendMutation.isPending} onClick={submitMessage} aria-label="Send message">{sendMutation.isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <Send className="h-4 w-4" />}</Button>
            </div>
          ) : <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">{conversation.is_blocked ? 'This conversation is blocked. Message history remains available.' : 'This conversation is closed.'}</p>}
        </div>
      </footer>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}><DialogContent><DialogHeader><DialogTitle>{conversation.blocked_by_me ? 'Unblock conversation?' : 'Block conversation?'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{conversation.blocked_by_me ? 'Both participants can send again unless the other participant has also blocked the conversation.' : 'Neither participant can send while either side has a block in place. Existing messages remain visible.'}</p><Button type="button" variant={conversation.blocked_by_me ? 'default' : 'destructive'} disabled={blockMutation.isPending} onClick={() => blockMutation.mutate(!conversation.blocked_by_me)}>{blockMutation.isPending ? 'Saving…' : conversation.blocked_by_me ? 'Unblock' : 'Block'}</Button></DialogContent></Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent><DialogHeader><DialogTitle>Report conversation</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="conversation-report-reason">Reason</Label><Select value={reportReason} onValueChange={setReportReason}><SelectTrigger id="conversation-report-reason"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="spam">Spam</SelectItem><SelectItem value="scam">Scam or fraud</SelectItem><SelectItem value="harassment">Harassment</SelectItem><SelectItem value="unsafe">Unsafe behaviour</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="conversation-report-details">Details (optional)</Label><Textarea id="conversation-report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} rows={4} /></div><Button type="button" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate()}>{reportMutation.isPending ? 'Submitting…' : 'Submit report'}</Button></DialogContent></Dialog>
    </section>
  );
}

function MessageBubble({ message, mine }) {
  const timeAgo = useTimeAgo(message.created_at);
  return <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}><p className="whitespace-pre-wrap break-words">{message.body}</p><p className={cn('mt-1 text-right text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{timeAgo}</p></div></div>;
}
