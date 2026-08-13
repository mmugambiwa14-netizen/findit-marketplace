import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { peekRequestCategoryLabel } from '@/domain/peekThreads/categories';
import { bindResponsePeek, getResponsePeekRequestCandidates, getUnboundResponsePeeks } from '@/services/peekThreadsService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import { useAuth } from '@/lib/AuthContext';

const READY_RESPONSE_REFRESH_MS = 30_000;

export default function ResponsePeekBindingQueue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const accountId = user?.id ?? null;
  const [active, setActive] = useState(null);
  const [selected, setSelected] = useState([]);
  const ready = useQuery({
    queryKey: ['unbound-response-peeks', accountId],
    queryFn: ({ signal }) => getUnboundResponsePeeks(signal),
    enabled: Boolean(accountId),
    staleTime: 15_000,
    refetchInterval: READY_RESPONSE_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const candidates = useQuery({
    queryKey: ['response-peek-candidates', accountId, active?.tourId],
    queryFn: ({ signal }) => getResponsePeekRequestCandidates(active.tourId, signal),
    enabled: Boolean(accountId && active?.tourId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (active && candidates.data?.length) setSelected(candidates.data.slice(0, 1).map((item) => item.requestId));
  }, [active, candidates.data]);

  const bind = useMutation({
    mutationFn: () => bindResponsePeek({ tourId: active.tourId, requestIds: selected }),
    onSuccess: (count) => {
      toast.success(`${Number(count) || selected.length} Peek Request${(Number(count) || selected.length) === 1 ? '' : 's'} answered`);
      setActive(null); setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['unbound-response-peeks', accountId], exact: true });
      queryClient.invalidateQueries({ queryKey: ['seller-peek-request-queue', accountId, 'tail'], exact: true });
      queryClient.invalidateQueries({ queryKey: ['peek-threads'] });
    },
    onError: (error) => toast.error(error.message || 'Unable to publish the Response Peek'),
  });

  if (ready.isLoading) return <ListRowsSkeleton rows={1} label="Checking Response Peeks" />;
  if (ready.isError || !ready.data?.length) return null;

  const toggle = (id) => setSelected((current) => current.includes(id)
    ? current.filter((value) => value !== id)
    : current.length < 25 ? [...current, id] : current);

  return (
    <section className="mx-4 mb-5 overflow-hidden rounded-2xl border border-primary/25 bg-card" aria-labelledby="ready-response-peeks-heading">
      <div className="border-b border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ready to attach</p>
        <h2 id="ready-response-peeks-heading" className="mt-1 text-lg font-black">Publish Response Peeks</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose which buyer requests each published Peek answers.</p>
      </div>
      <div className="divide-y divide-border">
        {ready.data.map((peek) => (
          <article key={peek.tourId} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{peek.parentTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{peek.pendingRequestCount} pending request{peek.pendingRequestCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="sm" onClick={() => { setActive(peek); setSelected([]); }} disabled={!peek.pendingRequestCount}>
              <Send className="mr-2 h-4 w-4" />Select requests
            </Button>
          </article>
        ))}
      </div>

      <AlertDialog open={Boolean(active)} onOpenChange={(open) => { if (!open && !bind.isPending) { setActive(null); setSelected([]); } }}>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Which requests does this Peek answer?</AlertDialogTitle>
            <AlertDialogDescription>Select up to 25 requests for {active?.parentTitle}. Buyers receive one notification even when several requests are answered.</AlertDialogDescription>
          </AlertDialogHeader>
          {candidates.isLoading ? (
            <ListRowsSkeleton rows={4} className="p-2" label="Loading matching Peek Requests" />
          ) : candidates.isError ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">Matching requests could not be loaded.</p>
          ) : (
            <div className="space-y-2">
              {(candidates.data || []).map((item) => {
                const checked = selected.includes(item.requestId);
                return (
                  <label key={item.requestId} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${checked ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="checkbox" aria-label={`Select Peek request: ${item.body}`} checked={checked} onChange={() => toggle(item.requestId)} className="mt-1 h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{peekRequestCategoryLabel(item.category)}</Badge><span className="text-xs font-semibold text-primary">{item.supporterCount} interested</span></span>
                      <span className="mt-2 block text-sm font-semibold">{item.body}</span>
                    </span>
                  </label>
                );
              })}
              {!candidates.data?.length && <p className="p-4 text-center text-sm text-muted-foreground">No eligible requests remain for this listing.</p>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bind.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!selected.length || bind.isPending} onClick={(event) => { event.preventDefault(); bind.mutate(); }}>
              {bind.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Publish response</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
