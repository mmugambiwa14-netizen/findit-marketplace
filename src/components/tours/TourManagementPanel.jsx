import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Film, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { featureFlags } from '@/lib/featureFlags';
import { invalidateCanonicalParentQueries } from '@/lib/canonicalQueryInvalidation';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';
import {
  getOwnerTours,
  removeListingTour,
  retryListingTour,
} from '@/services/listingToursService';
import TourFailureState from './TourFailureState';
import TourProcessingState from './TourProcessingState';
import TourUploader from './TourUploader';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

const TRANSIENT_STATUSES = new Set(['upload_authorized', 'uploaded', 'processing']);
const TERMINAL_HIDDEN = new Set(['superseded', 'cleaned']);

function sortRows(rows) {
  return [...(rows || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

function isCurrent(row) {
  return row.status === 'ready'
    && row.moderation_status === 'approved'
    && Boolean(row.published_at)
    && !row.removed_at;
}

function isPending(row) {
  if (row.moderation_status === 'rejected') return true;
  return !isCurrent(row)
    && !TERMINAL_HIDDEN.has(row.status)
    && row.status !== 'removed';
}

export default function TourManagementPanel({ parentType = 'listing', parentId, category, compact = false, onBusyChange = null }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState(null);

  useEffect(() => () => {
    if (draft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.previewUrl);
  }, [draft?.previewUrl]);
  const key = listingTourQueryKeys.ownerParent(parentType, parentId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => getOwnerTours(parentType, parentId),
    enabled: featureFlags.tours && Boolean(parentId),
    refetchInterval: (state) => state.state.data?.some((row) => TRANSIENT_STATUSES.has(row.status)) ? 8000 : false,
  });

  const rows = useMemo(() => sortRows(query.data), [query.data]);
  const current = rows.find(isCurrent) || null;
  const currentCreatedAt = current ? new Date(current.created_at || 0).getTime() : 0;
  const newestAfterCurrent = rows.find((row) => row.id !== current?.id
    && (!current || new Date(row.created_at || 0).getTime() > currentCreatedAt)) || null;
  const latestIssue = newestAfterCurrent
    && (newestAfterCurrent.status === 'failed' || newestAfterCurrent.moderation_status === 'rejected')
    ? newestAfterCurrent
    : null;
  const pending = newestAfterCurrent && isPending(newestAfterCurrent) && !latestIssue
    ? newestAfterCurrent
    : null;
  const rejectedIssue = latestIssue?.moderation_status === 'rejected';
  const blockingPending = Boolean(rejectedIssue)
    || Boolean(pending && ['upload_authorized', 'uploaded', 'processing', 'ready'].includes(pending.status));
  const resumablePending = Boolean(
    draft?.file
    && draft.status === 'error'
    && draft.resumeUpload?.tourId
    && pending?.id === draft.resumeUpload.tourId,
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: listingTourQueryKeys.all });
    await invalidateCanonicalParentQueries(queryClient, {
      parentType,
      parentId,
      kind: parentType === 'listing' ? category : null,
    });
  };

  const removeMutation = useMutation({
    mutationFn: removeListingTour,
    onSuccess: async () => {
      setDraft(null);
      await refresh();
      toast.success('Peek removed');
    },
    onError: (error) => toast.error(error.message || 'The Peek could not be removed'),
  });

  const retryMutation = useMutation({
    mutationFn: retryListingTour,
    onSuccess: async () => {
      await refresh();
      toast.success('Peek processing queued again');
    },
    onError: (error) => toast.error(error.message || 'The Peek could not be retried'),
  });

  const mutationBusy = removeMutation.isPending || retryMutation.isPending;
  const busy = uploadBusy || mutationBusy;
  useEffect(() => {
    onBusyChange?.(busy);
    return () => {
      if (busy) onBusyChange?.(false);
    };
  }, [busy, onBusyChange]);

  if (!featureFlags.tours || !parentId) return null;

  const remove = (tour) => setRemoveCandidate(tour);

  const confirmRemove = () => {
    if (!removeCandidate || removeMutation.isPending) return;
    removeMutation.mutate(removeCandidate.id, { onSuccess: () => setRemoveCandidate(null) });
  };

  return (
    <section className={`space-y-4 ${compact ? '' : 'rounded-2xl border border-border bg-card p-4'}`} aria-labelledby={`tour-management-${parentId}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`tour-management-${parentId}`} className="flex items-center gap-2 font-semibold"><Film className="h-5 w-5 text-primary" />Peek video</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">One Peek stays attached to this {parentType}. Replacements become public after processing and activation.</p>
        </div>
        {query.isFetching && <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing Peek status" />}
      </div>

      {query.isLoading && (
        <SkeletonRegion label="Loading Peek status" className="rounded-xl border border-border p-3"><div className="flex items-center gap-3"><Skeleton className="h-14 w-20 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-1/2" /></div></div></SkeletonRegion>
      )}

      {query.isError && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <p>{query.error?.message || 'Peek status could not be loaded.'}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => query.refetch()}>Try again</Button>
        </div>
      )}

      {current && (
        <div className="rounded-xl border border-success/25 bg-success/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-semibold">Current public Peek</p>
                <p className="mt-1 text-xs text-muted-foreground">Visible while this {parentType} remains publicly available.</p>
              </div>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(current)} disabled={busy}><Trash2 />Remove</Button>
          </div>
        </div>
      )}

      {latestIssue?.moderation_status === 'rejected' && (
        <TourFailureState
          tour={latestIssue}
          onRemove={() => remove(latestIssue)}
          removing={removeMutation.isPending}
        />
      )}
      {latestIssue?.status === 'failed' && latestIssue.moderation_status !== 'rejected' && (
        <TourFailureState
          tour={latestIssue}
          retrying={retryMutation.isPending}
          onRetry={() => retryMutation.mutate(latestIssue.id)}
          onRemove={() => remove(latestIssue)}
          removing={removeMutation.isPending}
        />
      )}
      {pending && !resumablePending && !['failed'].includes(pending.status) && pending.moderation_status !== 'rejected' && (
        <div className="space-y-2">
          <TourProcessingState tour={pending} />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(pending)} disabled={busy}><Trash2 />Cancel this version</Button>
        </div>
      )}

      {current && (pending || latestIssue) && <p className="rounded-xl bg-primary/5 p-3 text-xs text-muted-foreground">Your current public Peek remains visible until the replacement is active. A failed replacement does not remove it.</p>}

      {!query.isLoading && !query.isError && (!blockingPending || resumablePending) && (
        <TourUploader
          parentType={parentType}
          parentId={parentId}
          category={category}
          value={draft}
          onChange={setDraft}
          onUploadFailed={refresh}
          onUploaded={async () => {
            setDraft(null);
            await refresh();
            toast.success('Peek uploaded and queued for processing');
          }}
          disabled={mutationBusy}
          heading={current ? 'Replace Peek' : 'Add a Peek'}
          onBusyChange={setUploadBusy}
        />
      )}

      <AlertDialog open={Boolean(removeCandidate)} onOpenChange={(open) => { if (!open && !removeMutation.isPending) setRemoveCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeCandidate && isCurrent(removeCandidate) ? 'Remove the public Peek?' : 'Remove this Peek version?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeCandidate && isCurrent(removeCandidate)
                ? `The Peek will be removed from this ${parentType}. The ${parentType} and its photos will remain.`
                : 'The unfinished or replacement Peek version will be cancelled and removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Removing</> : 'Remove Peek'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
