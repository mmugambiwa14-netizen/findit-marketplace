import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pause, Play, Search, ShieldX, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import CursorPager from '@/components/admin/CursorPager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getAdminMarketplace, moderateAdminMarketplace } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 25;
const itemPath = (item) => item.item_kind === 'service' ? `/service/${item.item_id}` : `/${item.item_kind}/${item.item_id}`;

function ModerationActions({ item, decide }) {
  const isProduct = item.item_kind !== 'service';
  const isLive = ['available', 'active', 'under_offer', 'rented'].includes(item.status);
  const canApprove = isProduct ? item.status === 'pending_review' : item.status === 'paused';
  const canReject = isProduct && item.status === 'pending_review';
  return <div className="flex gap-1">
    {isLive && <Button size="sm" variant="outline" onClick={() => decide(item, 'pause')}><Pause className="mr-1 h-3.5 w-3.5" />Pause</Button>}
    {canApprove && <Button size="sm" variant="outline" onClick={() => decide(item, 'publish')}><Play className="mr-1 h-3.5 w-3.5" />{isProduct ? 'Approve' : 'Publish'}</Button>}
    {canReject && <Button size="sm" variant="outline" onClick={() => decide(item, 'reject')}><ShieldX className="mr-1 h-3.5 w-3.5" />Reject</Button>}
    <Button size="sm" variant="destructive" onClick={() => decide(item, 'remove')}><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Remove</span></Button>
  </div>;
}

export default function AdminListings() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState(params.get('kind') || 'all');
  const [status, setStatus] = useState('all');
  const pagination = useCursorStack();
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const request = { query, kind, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const { data = { items: [], nextCursor: null }, isLoading, error } = useQuery({
    queryKey: ['admin-marketplace', request],
    queryFn: () => getAdminMarketplace(request),
  });
  const mutation = useMutation({
    mutationFn: moderateAdminMarketplace,
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      setDecision(null);
      setReason('');
      toast.success(input.action === 'remove' ? 'Advert removed' : 'Advert status updated');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const openDecision = (item, action) => { setDecision({ item, action }); setReason(''); };

  return <div className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div><h1 className="text-3xl font-bold">Marketplace</h1><p className="mt-1 text-muted-foreground">Review submitted products and operate product and service adverts.</p></div>
    <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search adverts" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Title, owner, or email" /></div>
      <Select value={kind} onValueChange={(value) => { setKind(value); pagination.reset(); }}><SelectTrigger aria-label="Filter adverts by type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="property">Property</SelectItem><SelectItem value="car">Vehicles</SelectItem><SelectItem value="machinery">Machinery</SelectItem><SelectItem value="service">Services</SelectItem></SelectContent></Select>
      <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter adverts by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending_review">Pending product review</SelectItem><SelectItem value="available">Published products</SelectItem><SelectItem value="rejected">Rejected products</SelectItem><SelectItem value="paused">Paused adverts</SelectItem><SelectItem value="unavailable">Unavailable products</SelectItem><SelectItem value="active">Active services</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="rented">Rented</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent></Select>
    </CardContent></Card>
    {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">Advert</th><th className="p-3">Type</th><th className="p-3">Price</th><th className="p-3">Owner</th><th className="p-3">Status</th><th className="p-3">Reports</th><th className="p-3">Actions</th></tr></thead><tbody>
      {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading marketplace…</td></tr> : data.items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No adverts match these filters.</td></tr> : data.items.map((item) => { const isLive = ['available', 'active', 'under_offer', 'rented'].includes(item.status); return <tr key={`${item.item_kind}-${item.item_id}`} className="border-b last:border-0"><td className="max-w-64 p-3 font-medium"><Link className="inline-flex items-center gap-1 hover:text-primary hover:underline" to={itemPath(item)} target="_blank" rel="noopener noreferrer">{item.title}<ExternalLink className="h-3 w-3" /></Link><p className="truncate text-xs text-muted-foreground">{item.category || 'Uncategorised'}</p></td><td className="p-3 capitalize">{item.item_kind === 'car' ? 'Vehicle' : item.item_kind}</td><td className="p-3">{item.price == null ? 'Contact' : `${item.currency} ${item.price.toLocaleString()}`}</td><td className="p-3"><p>{item.owner_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{item.owner_email}</p></td><td className="p-3"><Badge variant={isLive ? 'default' : 'secondary'}>{item.status.replace('_', ' ')}</Badge></td><td className="p-3">{item.report_count}</td><td className="p-3"><ModerationActions item={item} decide={openDecision} /></td></tr>; })}
    </tbody></table></div></Card>
    <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="records" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
  </div>
  <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}><DialogContent><DialogHeader><DialogTitle className="capitalize">{decision?.action === 'publish' && decision?.item.item_kind !== 'service' ? 'Approve' : decision?.action} advert</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This action is recorded in the audit log.{decision?.action === 'remove' ? ' Removing an advert is permanent.' : ''}{decision?.action === 'reject' ? ' The owner will receive this reason.' : ''}</p><div><Label htmlFor="moderation-reason">Reason</Label><Textarea id="moderation-reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the policy or operational reason" /></div><Button variant={['remove', 'reject'].includes(decision?.action) ? 'destructive' : 'default'} disabled={reason.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate({ itemId: decision.item.item_id, kind: decision.item.item_kind, action: decision.action, reason })}>{mutation.isPending ? 'Saving…' : 'Confirm action'}</Button></DialogContent></Dialog>
  </div>;
}
