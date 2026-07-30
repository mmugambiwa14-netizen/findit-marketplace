import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, ExternalLink, Flag, ImageOff, Loader2, Play, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTimeAgo } from '@/hooks/useTimeAgo';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import {
  getMessageConversationMetadata,
  getMessageThreadPage,
  markConversationSeen,
  reportMessageConversation,
  sendConversationMessage,
  setConversationBlocked,
} from '@/services/messagingService';

const THREAD_PAGE_SIZE = 50;
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

export default function ConversationThread({ conversationId, currentUser, onBack }) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const scrollRef = useRef(null);
  const firstScrollRef = useRef(true);
  const scrollAfterSendRef = useRef(false);
  const olderScrollRef = useRef(null);
  const [text, setText] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('scam');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    firstScrollRef.current = true;
    scrollAfterSendRef.current = false;
    olderScrollRef.current = null;
    setText('');
    setBlockOpen(false);
    setReportOpen(false);
    setReportDetails('');
  }, [conversationId]);

  const conversationQuery = useQuery({
    queryKey: ['message-conversation-metadata', conversationId],
    queryFn: () => getMessageConversationMetadata(conversationId),
    enabled: Boolean(conversationId && currentUser?.id),
    staleTime: 15_000,
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ['message-thread', conversationId],
    queryFn: ({ pageParam }) => getMessageThreadPage(conversationId, { cursor: pageParam || null, limit: THREAD_PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: Boolean(conversationId && currentUser?.id),
    staleTime: 10_000,
  });

  const messages = useMemo(() => {
    const byId = new Map();
    const pages = [...(messagesQuery.data?.pages || [])].reverse();
    for (const page of pages) for (const item of page.items) byId.set(item.message_id, item);
    return [...byId.values()];
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!conversationQuery.data || !messagesQuery.data) return;
    markConversationSeen(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['message-inbox'] }))
      .catch(() => {});
  }, [conversationId, conversationQuery.data, messagesQuery.data, queryClient]);

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
      await queryClient.resetQueries({ queryKey: ['message-thread', conversationId], exact: true });
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
  if (loading) return <div className="flex min-h-screen justify-center py-20" aria-label="Loading conversation"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;
  if (failed) return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">We could not load this conversation</h1><p className="mt-2 text-sm text-muted-foreground">It may be unavailable, or you may not be a participant.</p><Button type="button" variant="outline" className="mt-5" onClick={onBack}>Back to messages</Button></div>;
  if (!conversationQuery.data) return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h1 className="text-xl font-semibold">Conversation not found</h1><Button type="button" variant="outline" className="mt-5" onClick={onBack}>Back to messages</Button></div>;

  const conversation = conversationQuery.data;
  const submitMessage = () => { if (text.trim() && !sendMutation.isPending) sendMutation.mutate(); };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-muted/20">
      <header className="shrink-0 border-b bg-card/95 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to messages"><ArrowLeft className="h-5 w-5" /></Button>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{conversation.other_user_name}</p>
            <Button type="button" variant="ghost" size="icon" onClick={() => setReportOpen(true)} aria-label="Report conversation"><Flag className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setBlockOpen(true)} aria-label={conversation.blocked_by_me ? 'Unblock conversation' : 'Block conversation'}><Ban className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-2.5">
            <Link to={listingPath(conversation)} className="h-14 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted" aria-label={`View ${conversation.listing_title}`}>
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

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-3xl space-y-3">
          {messagesQuery.hasNextPage && (
            <div className="flex justify-center pb-2">
              <Button type="button" variant="outline" size="sm" disabled={messagesQuery.isFetchingNextPage} onClick={loadOlder}>
                {messagesQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : 'Load older messages'}
              </Button>
            </div>
          )}
          {messages.map((message) => <MessageBubble key={message.message_id} message={message} mine={message.sender_id === currentUser.id} />)}
        </div>
      </main>

      <footer className="shrink-0 border-t bg-card p-3">
        <div className="mx-auto max-w-3xl">
          {conversation.can_send ? (
            <div className="flex items-end gap-2">
              <label htmlFor="conversation-message" className="sr-only">Message</label>
              <Textarea id="conversation-message" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} rows={1} maxLength={2000} placeholder="Write a message" className="min-h-11 max-h-32 flex-1 resize-none" />
              <Button type="button" size="icon" className="h-11 w-11 shrink-0" disabled={!text.trim() || sendMutation.isPending} onClick={submitMessage} aria-label="Send message">{sendMutation.isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <Send className="h-4 w-4" />}</Button>
            </div>
          ) : <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">{conversation.is_blocked ? 'This conversation is blocked. Message history remains available.' : 'This conversation is closed.'}</p>}
        </div>
      </footer>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}><DialogContent><DialogHeader><DialogTitle>{conversation.blocked_by_me ? 'Unblock conversation?' : 'Block conversation?'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{conversation.blocked_by_me ? 'Both participants can send again unless the other participant has also blocked the conversation.' : 'Neither participant can send while either side has a block in place. Existing messages remain visible.'}</p><Button type="button" variant={conversation.blocked_by_me ? 'default' : 'destructive'} disabled={blockMutation.isPending} onClick={() => blockMutation.mutate(!conversation.blocked_by_me)}>{blockMutation.isPending ? 'Saving…' : conversation.blocked_by_me ? 'Unblock' : 'Block'}</Button></DialogContent></Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent><DialogHeader><DialogTitle>Report conversation</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="conversation-report-reason">Reason</Label><Select value={reportReason} onValueChange={setReportReason}><SelectTrigger id="conversation-report-reason"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="spam">Spam</SelectItem><SelectItem value="scam">Scam or fraud</SelectItem><SelectItem value="harassment">Harassment</SelectItem><SelectItem value="unsafe">Unsafe behaviour</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="conversation-report-details">Details (optional)</Label><Textarea id="conversation-report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} rows={4} /></div><Button type="button" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate()}>{reportMutation.isPending ? 'Submitting…' : 'Submit report'}</Button></DialogContent></Dialog>
    </div>
  );
}

function MessageBubble({ message, mine }) {
  const timeAgo = useTimeAgo(message.created_at);
  return <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}><p className="whitespace-pre-wrap break-words">{message.body}</p><p className={cn('mt-1 text-right text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{timeAgo}</p></div></div>;
}
