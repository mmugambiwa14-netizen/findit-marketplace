import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Search, ShieldX } from 'lucide-react';
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
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useCursorStack } from '@/hooks/useCursorStack';
import { getAdminTourQueue, moderateAdminTour } from '@/services/adminService';
import { TableRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const PAGE_SIZE = 25;
const STATUSES = ['pending', 'processing', 'ready', 'failed', 'approved', 'rejected', 'published', 'all'];

function maskEmail(value) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return 'Not supplied';
  return `${name.slice(0, 2)}${name.length > 2 ? '***' : ''}@${domain}`;
}

function canReview(item) {
  return ['ready', 'pending'].includes(item.status) || item.moderation_status === 'pending';
}

export default function AdminPeeks() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState('pending');
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const pagination = useCursorStack();
  const queryClient = useQueryClient();
  const request = { query: debouncedQuery, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const queue = useQuery({
    queryKey: ['admin-peeks', request],
    queryFn: () => getAdminTourQueue(request),
    placeholderData: (previous) => previous,
    refetchInterval: document.visibilityState === 'visible' ? 60_000 : false,
  });
  const mutation = useMutation({
    mutationFn: moderateAdminTour,
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-peeks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
      setDecision(null);
      setReason('');
      setConfirmation('');
      toast.success(input.action === 'approve' ? 'Peek approved' : 'Peek rejected');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const data = queue.data || { items: [], nextCursor: null };
  const expectedConfirmation = decision?.action === 'reject' ? 'REJECT' : 'APPROVE';

  return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header><h1 className="text-3xl font-bold">Peek moderation</h1><p className="mt-1 text-muted-foreground">Review processed listing videos, reports and failures before public publication.</p></header>
        <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-[1fr_16rem]">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search Peeks" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Listing, owner or Peek ID" /></div>
          <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter Peeks by status"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((item) => <SelectItem key={item} value={item}>{item === 'all' ? 'All statuses' : item[0].toUpperCase() + item.slice(1)}</SelectItem>)}</SelectContent></Select>
        </CardContent></Card>
        {queue.error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"><p>{queue.error.message}</p>{queue.error.correlationId && <p className="mt-1 text-xs">Reference: {queue.error.correlationId}</p>}<Button className="mt-3" size="sm" variant="outline" onClick={() => queue.refetch()}>Try again</Button></div>}
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">Peek</th><th className="p-3">Owner</th><th className="p-3">Processing</th><th className="p-3">Reports</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead><tbody>
          {queue.isLoading ? <TableRowsSkeleton columns={6} label="Loading Peek queue" /> : data.items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No Peeks match these filters.</td></tr> : data.items.map((item) => <tr key={item.tour_id} className="border-b align-top last:border-0"><td className="max-w-xs p-3"><Link to={item.parent_path || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-primary hover:underline">{item.parent_title || 'Untitled listing'}<ExternalLink className="h-3 w-3" /></Link><p className="mt-1 text-xs text-muted-foreground">{item.parent_type} · {String(item.tour_id).slice(0, 8)}</p><p className="mt-1 text-xs text-muted-foreground">{Number(item.duration_seconds || 0).toFixed(1)} seconds</p></td><td className="p-3"><p>{item.owner_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{maskEmail(item.owner_email)}</p>{Number(item.owner_rejected_tour_count || 0) > 0 && <p className="mt-1 text-xs text-warning">{item.owner_rejected_tour_count} previous rejection(s)</p>}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{item.status}</Badge><Badge variant={item.moderation_status === 'approved' ? 'default' : item.moderation_status === 'rejected' ? 'destructive' : 'outline'}>{item.moderation_status}</Badge></div>{item.failure_message && <p className="mt-2 max-w-xs text-xs text-destructive">{item.failure_message}</p>}{item.rejection_reason && <p className="mt-2 max-w-xs text-xs text-muted-foreground">Previous reason: {item.rejection_reason}</p>}</td><td className="p-3">{Number(item.report_count || 0)}{item.latest_report_reason && <p className="mt-1 max-w-xs text-xs text-muted-foreground">Latest: {item.latest_report_reason}</p>}</td><td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td><td className="p-3">{canReview(item) ? <div className="flex gap-2"><Button size="sm" onClick={() => { setDecision({ item, action: 'approve' }); setReason(''); setConfirmation(''); }}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" onClick={() => { setDecision({ item, action: 'reject' }); setReason(''); setConfirmation(''); }}><ShieldX className="mr-1 h-4 w-4" />Reject</Button></div> : <span className="text-xs text-muted-foreground">No decision available</span>}</td></tr>)}
        </tbody></table></div></Card>
        <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="Peeks" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
      </div>
      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !mutation.isPending) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle>{decision?.action === 'approve' ? 'Approve this Peek?' : 'Reject this Peek?'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This changes public evidence availability and creates an immutable audit entry. Review the listing and any reports before continuing.</p><div><Label htmlFor="peek-moderation-reason">Decision reason</Label><Textarea id="peek-moderation-reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="State what was reviewed and why this decision is appropriate" /></div><div><Label htmlFor="peek-moderation-confirmation">Type {expectedConfirmation} to confirm</Label><Input id="peek-moderation-confirmation" className="mt-1" value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" /></div><Button variant={decision?.action === 'reject' ? 'destructive' : 'default'} disabled={reason.trim().length < 3 || confirmation !== expectedConfirmation || mutation.isPending} onClick={() => mutation.mutate({ tourId: decision.item.tour_id, action: decision.action, reason })}>{mutation.isPending ? 'Saving decision…' : `Confirm ${decision?.action}`}</Button></DialogContent></Dialog>
    </div>
  );
}
