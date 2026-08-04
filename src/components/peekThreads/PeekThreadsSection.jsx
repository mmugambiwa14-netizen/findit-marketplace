import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Eye, Loader2, Plus, ThumbsUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ResponsePeekWatchButton from '@/components/peekThreads/ResponsePeekWatchButton';
import { PEEK_REQUEST_CATEGORIES, peekRequestCategoryLabel, suggestedRequests } from '@/domain/peekThreads/categories';
import { findDuplicateRequest } from '@/domain/peekThreads/requestContracts';
import { useAuth } from '@/lib/AuthContext';
import {
  createPeekRequest,
  declinePeekRequest,
  getPeekThreadPage,
  supportPeekRequest,
  withdrawPeekRequestSupport,
} from '@/services/peekThreadsService';

const FILTERS = [
  { value: 'all', label: 'Top requests', sort: 'most_wanted' },
  { value: 'answered', label: 'Answered', sort: 'newest' },
  { value: 'pending', label: 'Awaiting response', sort: 'most_wanted' },
  { value: 'all', label: 'Newest', sort: 'newest' },
];

export default function PeekThreadsSection({
  parentType = 'listing',
  parentId,
  listingKind = 'property',
  ownerId = null,
  guard,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState(suggestedRequests(listingKind)[0]?.category || 'condition');
  const [body, setBody] = useState('');
  const filter = FILTERS[activeFilter];
  const queryKey = ['peek-threads', parentType, parentId, filter.value, filter.sort];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getPeekThreadPage({ parentType, parentId, filter: filter.value, sort: filter.sort, limit: 20 }),
    enabled: Boolean(parentId),
    staleTime: 60_000,
  });

  const items = data?.items || [];
  const duplicate = useMemo(
    () => body.trim().length >= 8 ? findDuplicateRequest(body, category, items.map((item) => ({
      id: item.id,
      body: item.body,
      category: item.category,
      status: item.status,
      supporter_count: item.supporterCount,
    }))) : null,
    [body, category, items],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['peek-threads', parentType, parentId] });

  const createMutation = useMutation({
    mutationFn: () => createPeekRequest({ parentType, parentId, category, body }),
    onSuccess: () => {
      setBody('');
      setComposerOpen(false);
      refresh();
      toast.success('Your Peek Request was submitted');
    },
    onError: (mutationError) => toast.error(mutationError.message || 'Unable to submit the Peek Request'),
  });

  const supportMutation = useMutation({
    mutationFn: ({ requestId, supported }) => supported
      ? withdrawPeekRequestSupport(requestId)
      : supportPeekRequest(requestId),
    onSuccess: refresh,
    onError: (mutationError) => toast.error(mutationError.message || 'Unable to update your interest'),
  });

  const declineMutation = useMutation({
    mutationFn: ({ requestId, reason }) => declinePeekRequest({ requestId, reason }),
    onSuccess: () => {
      refresh();
      toast.success('Peek Request declined');
    },
    onError: (mutationError) => toast.error(mutationError.message || 'Unable to decline this request'),
  });

  const isOwner = Boolean(user?.id && ownerId && user.id === ownerId);

  const submitRequest = () => guard?.('request a Peek', () => {
    if (duplicate) {
      supportMutation.mutate({ requestId: duplicate.id, supported: false });
      return;
    }
    createMutation.mutate();
  });

  return (
    <section className="surface-panel overflow-hidden" aria-labelledby={`peek-threads-${parentId}`}>
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Visual evidence</p>
            <h2 id={`peek-threads-${parentId}`} className="mt-1 text-xl font-black tracking-tight">Peek Threads</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ask for specific visual proof. The seller’s response becomes public evidence for everyone considering this listing.
            </p>
          </div>
          {!isOwner && (
            <Button type="button" size="sm" onClick={() => guard?.('request a Peek', () => setComposerOpen((open) => !open))}>
              <Plus className="mr-2 h-4 w-4" />Request a Peek
            </Button>
          )}
        </div>

        {composerOpen && !isOwner && (
          <div className="mt-5 rounded-2xl border border-border bg-surface-secondary p-4">
            <label className="text-sm font-semibold" htmlFor={`peek-category-${parentId}`}>What do you want to see?</label>
            <select
              id={`peek-category-${parentId}`}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
            >
              {PEEK_REQUEST_CATEGORIES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">{PEEK_REQUEST_CATEGORIES.find((entry) => entry.value === category)?.hint}</p>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Describe one clear thing the seller can show"
              className="mt-3 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{body.trim().length}/280</span>
              <div className="flex flex-wrap justify-end gap-2">
                {suggestedRequests(listingKind).slice(0, 3).map((suggestion) => (
                  <button key={suggestion.body} type="button" className="rounded-full border border-border px-2.5 py-1 hover:border-primary" onClick={() => { setCategory(suggestion.category); setBody(suggestion.body); }}>
                    {suggestion.body}
                  </button>
                ))}
              </div>
            </div>
            {duplicate && (
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm">
                <p className="font-semibold">A similar request already exists.</p>
                <p className="mt-1 text-muted-foreground">“{duplicate.body}”</p>
                <p className="mt-1 text-xs text-muted-foreground">Support it instead so the seller sees the combined demand.</p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
              <Button type="button" disabled={body.trim().length < 8 || createMutation.isPending || supportMutation.isPending} onClick={submitRequest}>
                {(createMutation.isPending || supportMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {duplicate ? 'I want this too' : 'Submit request'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-border px-3 py-3 sm:px-5">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Peek Thread filters">
          {FILTERS.map((entry, index) => (
            <button
              key={`${entry.label}-${index}`}
              type="button"
              role="tab"
              aria-selected={activeFilter === index}
              onClick={() => setActiveFilter(index)}
              className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${activeFilter === index ? 'bg-primary text-primary-foreground' : 'bg-surface-secondary text-muted-foreground hover:text-foreground'}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border">
        {isLoading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Peek Requests</div>}
        {error && <div className="p-6 text-center"><p className="text-sm text-destructive">Peek Requests could not be loaded.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button></div>}
        {!isLoading && !error && items.length === 0 && (
          <div className="p-8 text-center">
            <Eye className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 font-semibold">No Peek Requests here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first buyer to ask for useful visual evidence.</p>
          </div>
        )}
        {items.map((item) => (
          <ThreadCard
            key={item.id}
            item={item}
            isOwner={isOwner}
            busy={supportMutation.isPending || declineMutation.isPending}
            onSupport={() => guard?.('support this Peek Request', () => supportMutation.mutate({ requestId: item.id, supported: false }))}
            onDecline={() => {
              const reason = window.prompt('Briefly tell buyers why this cannot be shown.');
              if (reason?.trim()) declineMutation.mutate({ requestId: item.id, reason });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ThreadCard({ item, isOwner, busy, onSupport, onDecline }) {
  const answered = item.status === 'answered' && item.responsePeek;
  return (
    <article className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{peekRequestCategoryLabel(item.category)}</Badge>
            {answered ? <Badge className="bg-success/15 text-success"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Answered</Badge> : <Badge variant="outline"><Clock3 className="mr-1 h-3.5 w-3.5" />Awaiting seller</Badge>}
          </div>
          <h3 className="mt-3 text-base font-bold leading-6">{item.body}</h3>
          <p className="mt-2 text-sm font-semibold text-primary">{item.supporterCount === 1 ? '1 buyer wants this' : `${item.supporterCount} buyers want this`}</p>
        </div>
      </div>

      {answered ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-success/20 bg-success/10 p-4">
          <div>
            <p className="text-sm font-semibold">Response Peek available</p>
            <p className="mt-1 text-xs text-muted-foreground">Captured {new Date(item.responsePeek.capturedAt).toLocaleDateString()}</p>
          </div>
          <ResponsePeekWatchButton tourId={item.responsePeek.id} title={item.body} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {!isOwner && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSupport}><ThumbsUp className="mr-2 h-4 w-4" />I want this too</Button>}
          {isOwner && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onDecline}><XCircle className="mr-2 h-4 w-4" />Decline</Button>}
          {isOwner && <Button type="button" size="sm" disabled title="Response recording uses the existing Peek uploader in the seller queue step"><Eye className="mr-2 h-4 w-4" />Record response</Button>}
        </div>
      )}
    </article>
  );
}
