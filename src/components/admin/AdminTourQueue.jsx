import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Film, Loader2, Play, Search, ShieldAlert, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import CursorPager from '@/components/admin/CursorPager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { reviewAdminReport, setAdminUserStatus } from '@/services/adminService';
import {
  approveListingTour,
  getAdminTourQueue,
  getAdminTourReviewAccess,
  rejectListingTour,
} from '@/services/listingToursService';
import { listingTourQueryKeys } from '@/services/listingTourQueryKeys';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 20;
const REPORT_REASON_LABELS = {
  unrelated_video: 'Unrelated video',
  misleading_representation: 'Misleading representation',
  stolen_content: 'Stolen content',
  unsafe_content: 'Unsafe content',
  inappropriate_content: 'Inappropriate content',
  prohibited_watermark: 'Prohibited watermark',
  suspected_fraud: 'Suspected fraud',
  duplicate_content: 'Duplicate content',
};

const decisionCopy = {
  approve: ['Approve Tour', 'Publish this ready Tour to its eligible parent.'],
  reject: ['Reject Tour', 'Remove this Tour without deleting the parent listing or service.'],
  restore: ['Restore Tour', 'Dismiss the active Tour report and restore publication if the parent remains eligible.'],
  remove: ['Remove Tour', 'Action the active Tour report and remove only the video.'],
  suspend: ['Suspend seller', 'Suspend this account because of repeated Tour policy violations.'],
};

function durationLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default function AdminTourQueue() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('pending');
  const pagination = useCursorStack();
  const [reviewTour, setReviewTour] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const request = { query, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const queue = useQuery({
    queryKey: [...listingTourQueryKeys.adminQueue(status), query, pagination.cursor],
    queryFn: () => getAdminTourQueue(request),
  });
  const media = useQuery({
    queryKey: ['listing-tours', 'admin-review-media', reviewTour?.tour_id],
    queryFn: () => getAdminTourReviewAccess(reviewTour.tour_id),
    enabled: Boolean(reviewTour?.tour_id),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async ({ action, tour, reason: actionReason }) => {
      if (action === 'approve') return approveListingTour(tour.tour_id, actionReason);
      if (action === 'reject') return rejectListingTour(tour.tour_id, actionReason);
      if (action === 'restore') {
        return tour.latest_report_id
          ? reviewAdminReport({ reportId: tour.latest_report_id, status: 'dismissed', notes: actionReason })
          : approveListingTour(tour.tour_id, actionReason);
      }
      if (action === 'remove') {
        return tour.latest_report_id
          ? reviewAdminReport({ reportId: tour.latest_report_id, status: 'actioned', notes: actionReason })
          : rejectListingTour(tour.tour_id, actionReason);
      }
      if (action === 'suspend') {
        return setAdminUserStatus({ userId: tour.owner_id, status: 'suspended', reason: actionReason });
      }
      throw new TypeError('Unsupported Tour moderation action');
    },
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['listing-tours'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      ]);
      setDecision(null);
      setReason('');
      if (reviewTour?.tour_id === input.tour.tour_id) setReviewTour(null);
      toast.success(input.action === 'suspend' ? 'Seller suspended' : 'Tour moderation decision recorded');
    },
    onError: (error) => toast.error(error.message || 'Tour moderation failed'),
  });

  const data = queue.data ?? { items: [], nextCursor: null };
  const openDecision = (action, tour) => { setReviewTour(null); setDecision({ action, tour }); setReason(''); };
  const confirmDecision = () => mutation.mutate({ ...decision, reason });

  return (
    <div className="space-y-5">
      <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-2">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search Tour moderation queue" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} maxLength={100} placeholder="Listing, seller, report reason, or failure code" /></div>
        <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter Tours by moderation status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending review</SelectItem><SelectItem value="reported">Reported</SelectItem><SelectItem value="failed">Processing failures</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="all">All Tours</SelectItem></SelectContent></Select>
      </CardContent></Card>

      {queue.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{queue.error.message}</p>}
      {queue.isLoading ? (
        <Card className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading Tour moderation queue…</Card>
      ) : data.items.length === 0 ? (
        <Card className="p-10 text-center"><Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-muted-foreground">No Tours match these filters.</p></Card>
      ) : (
        <div className="space-y-3">{data.items.map((tour) => <TourModerationCard key={tour.tour_id} tour={tour} onReview={setReviewTour} onDecision={openDecision} busy={mutation.isPending} />)}</div>
      )}

      <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="Tours" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />

      <Dialog open={Boolean(reviewTour)} onOpenChange={(open) => !open && setReviewTour(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Review Tour media</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{reviewTour?.parent_title}</p>
          {media.isLoading ? <div className="flex aspect-video items-center justify-center rounded-xl bg-muted" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" /><span className="sr-only">Loading review media</span></div> : media.error ? <div className="space-y-3 rounded-xl bg-destructive/10 p-4 text-sm text-destructive" role="alert"><p>{media.error.message}</p><Button type="button" size="sm" variant="outline" onClick={() => media.refetch()}>Retry review media</Button></div> : media.data?.playbackUrl ? <video src={media.data.playbackUrl} poster={media.data.thumbnailUrl || undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black object-contain" /> : media.data?.thumbnailUrl ? <img src={media.data.thumbnailUrl} alt="Tour review thumbnail" className="aspect-video w-full rounded-xl bg-muted object-contain" /> : <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">No processed review media is available for this state.</div>}
          <div className="flex flex-wrap justify-end gap-2">
            {reviewTour?.parent_path && <Button asChild variant="outline"><Link to={reviewTour.parent_path} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />View parent</Link></Button>}
            {reviewTour?.status === 'ready' && reviewTour?.moderation_status === 'pending' && <><Button onClick={() => openDecision('approve', reviewTour)}>Approve</Button><Button variant="destructive" onClick={() => openDecision('reject', reviewTour)}>Reject</Button></>}
            {reviewTour?.moderation_status === 'reported' && <><Button onClick={() => openDecision('restore', reviewTour)}>Restore</Button><Button variant="destructive" onClick={() => openDecision('remove', reviewTour)}>Remove Tour</Button></>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && !mutation.isPending && setDecision(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decision ? decisionCopy[decision.action][0] : 'Moderation decision'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{decision ? decisionCopy[decision.action][1] : ''}</p>
          {decision?.action === 'remove' && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">The canonical listing or service will remain intact. Only the Tour is removed.</p>}
          <div className="space-y-2"><Label htmlFor="tour-admin-reason">Decision reason</Label><Textarea id="tour-admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={5} placeholder="Explain the policy or evidence behind this action" /></div>
          <Button variant={['reject', 'remove', 'suspend'].includes(decision?.action) ? 'destructive' : 'default'} disabled={reason.trim().length < 3 || mutation.isPending} onClick={confirmDecision}>{mutation.isPending ? 'Saving…' : 'Confirm decision'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TourModerationCard({ tour, onReview, onDecision, busy }) {
  const readyForDecision = tour.status === 'ready' && tour.moderation_status === 'pending';
  const reported = tour.moderation_status === 'reported';
  const removable = tour.status === 'failed' || tour.moderation_status === 'approved';
  const repeated = tour.owner_rejected_tour_count > 0;

  return (
    <Card><CardContent className="space-y-4 pt-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{tour.parent_title || 'Removed parent'}</p><Badge variant="outline">{tour.parent_type}</Badge><Badge>{tour.status}</Badge><Badge variant={reported ? 'destructive' : 'secondary'}>{tour.moderation_status}</Badge>{tour.duration_seconds != null && <Badge variant="outline">{durationLabel(tour.duration_seconds)}</Badge>}</div>
          <p className="text-sm text-muted-foreground">Seller: {tour.owner_name || 'Unknown'} · {tour.owner_email} · account {tour.owner_status}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Parent: {tour.parent_status || 'removed'}</span><span>Reports: {tour.report_count}</span><span>Rejected Tours: {tour.owner_rejected_tour_count}</span><span>Created: {new Date(tour.created_at).toLocaleString()}</span></div>
          {tour.latest_report_reason && <p className="rounded-lg bg-destructive/5 p-3 text-sm"><span className="font-medium">Latest report:</span> {REPORT_REASON_LABELS[tour.latest_report_reason] || tour.latest_report_reason}</p>}
          {(tour.failure_message || tour.failure_code) && <p className="rounded-lg bg-warning/10 p-3 text-sm"><span className="font-medium">Processing failure:</span> {tour.failure_message || tour.failure_code}{tour.failure_code && tour.failure_message ? ` (${tour.failure_code})` : ''}</p>}
          {tour.rejection_reason && <p className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-medium">Rejection reason:</span> {tour.rejection_reason}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap content-start gap-2">
          <Button size="sm" variant="outline" onClick={() => onReview(tour)}><Play className="h-4 w-4" />Review media</Button>
          {tour.parent_path && <Button size="sm" variant="outline" asChild><Link to={tour.parent_path} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Parent</Link></Button>}
          {readyForDecision && <><Button size="sm" disabled={busy} onClick={() => onDecision('approve', tour)}>Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision('reject', tour)}>Reject</Button></>}
          {reported && <><Button size="sm" disabled={busy} onClick={() => onDecision('restore', tour)}>Restore</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision('remove', tour)}>Remove Tour</Button></>}
          {removable && !reported && <Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision('remove', tour)}><ShieldAlert className="h-4 w-4" />Remove Tour</Button>}
          {repeated && tour.owner_status === 'active' && <Button size="sm" variant="destructive" disabled={busy} onClick={() => onDecision('suspend', tour)}><UserX className="h-4 w-4" />Suspend seller</Button>}
        </div>
      </div>
      {repeated && <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p>This seller has previous rejected Tours. Account suspension remains a manual, reasoned admin action.</p></div>}
    </CardContent></Card>
  );
}
