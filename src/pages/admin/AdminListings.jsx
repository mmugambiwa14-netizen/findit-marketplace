import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Search } from 'lucide-react';
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
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { getAdminMarketplace, moderateAdminMarketplace } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';
import { TableRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  ADMIN_MARKETPLACE_KIND_OPTIONS,
  ADMIN_MARKETPLACE_LIVE_STATUSES,
  ADMIN_MARKETPLACE_STATUS_OPTIONS,
  marketplaceActions,
} from '@/services/adminConfig';

const PAGE_SIZE = 25;
const itemPath = (item) => item.item_kind === 'service' ? `/service/${item.item_id}` : `/${item.item_kind}/${item.item_id}`;

function maskEmail(value) {
  const [name, domain] = String(value || '').split('@');
  if (!name || !domain) return 'Not supplied';
  return `${name.slice(0, 2)}${name.length > 2 ? '***' : ''}@${domain}`;
}

function ModerationActions({ item, decide }) {
  return <div className="flex flex-wrap gap-1">
    {marketplaceActions(item).map((action) => (
      <Button key={action.value} size="sm" variant={action.variant} onClick={() => decide(item, action.value)}>
        {action.label}
        {action.value === 'remove' && <span className="sr-only"> advert</span>}
      </Button>
    ))}
  </div>;
}

export default function AdminListings() {
  const [params] = useSearchParams();
  const kindParam = params.get('kind') || 'all';
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [kind, setKind] = useState(kindParam);
  const [status, setStatus] = useState('all');
  const pagination = useCursorStack();
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const queryClient = useQueryClient();
  const request = { query: debouncedQuery, kind, status, limit: PAGE_SIZE, cursor: pagination.cursor };
  const { data = { items: [], nextCursor: null }, isLoading, error, refetch } = useQuery({ queryKey: ['admin-marketplace', request], queryFn: () => getAdminMarketplace(request), placeholderData: (previous) => previous });
  const mutation = useMutation({
    mutationFn: moderateAdminMarketplace,
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
      setDecision(null); setReason(''); setConfirmation('');
      toast.success(input.action === 'remove' ? 'Advert removed' : 'Advert status updated');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const openDecision = (item, action) => { setDecision({ item, action }); setReason(''); setConfirmation(''); };
  const selectedAction = decision ? marketplaceActions(decision.item).find((action) => action.value === decision.action) : null;
  const destructive = Boolean(selectedAction?.destructive);
  const expectedConfirmation = selectedAction?.confirmation || '';

  useEffect(() => {
    if (kindParam !== kind) {
      setKind(kindParam);
      pagination.reset();
    }
  }, [kind, kindParam, pagination.reset]);

  return <div className="min-h-[100dvh] bg-background p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div><h1 className="text-3xl font-bold">Marketplace</h1><p className="mt-1 text-muted-foreground">Review submitted products and operate product and service adverts.</p></div>
    <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search adverts" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Title, owner, or email" /></div>
      <Select value={kind} onValueChange={(value) => { setKind(value); pagination.reset(); }}><SelectTrigger aria-label="Filter adverts by type"><SelectValue /></SelectTrigger><SelectContent>{ADMIN_MARKETPLACE_KIND_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter adverts by status"><SelectValue /></SelectTrigger><SelectContent>{ADMIN_MARKETPLACE_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
    </CardContent></Card>
    {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"><p>{error.message}</p>{error.correlationId && <p className="mt-1 text-xs">Reference: {error.correlationId}</p>}<Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>Try again</Button></div>}
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">Advert</th><th className="p-3">Type</th><th className="p-3">Price</th><th className="p-3">Owner</th><th className="p-3">Status</th><th className="p-3">Reports</th><th className="p-3">Actions</th></tr></thead><tbody>
       {isLoading ? <TableRowsSkeleton columns={7} label="Loading marketplace" /> : data.items.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No adverts match these filters.</td></tr> : data.items.map((item) => { const isLive = ADMIN_MARKETPLACE_LIVE_STATUSES.includes(item.status); return <tr key={`${item.item_kind}-${item.item_id}`} className="border-b last:border-0"><td className="max-w-64 p-3 font-medium"><Link className="inline-flex items-center gap-1 hover:text-primary hover:underline" to={itemPath(item)} target="_blank" rel="noopener noreferrer">{item.title}<ExternalLink className="h-3 w-3" /></Link><p className="truncate text-xs text-muted-foreground">{item.category || 'Uncategorised'}</p></td><td className="p-3 capitalize">{item.item_kind === 'car' ? 'Vehicle' : item.item_kind}</td><td className="p-3">{item.price == null ? 'Contact' : `${item.currency} ${item.price.toLocaleString()}`}</td><td className="p-3"><p>{item.owner_name || 'Unknown'}</p><p className="text-xs text-muted-foreground">{maskEmail(item.owner_email)}</p></td><td className="p-3"><Badge variant={isLive ? 'default' : 'secondary'}>{item.status.replaceAll('_', ' ')}</Badge></td><td className="p-3">{item.report_count}</td><td className="p-3"><ModerationActions item={item} decide={openDecision} /></td></tr>; })}
    </tbody></table></div></Card>
    <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="records" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
  </div>
  <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !mutation.isPending) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle className="capitalize">{decision?.action === 'publish' && decision?.item.item_kind !== 'service' ? 'Approve' : decision?.action} advert</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This action is recorded in the audit log.{decision?.action === 'remove' ? ' Removing an advert is permanent and closes public access.' : ''}{decision?.action === 'reject' ? ' The owner will receive this reason.' : ''}</p><div><Label htmlFor="moderation-reason">Reason</Label><Textarea id="moderation-reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the policy or operational reason" /></div>{destructive && <div><Label htmlFor="moderation-confirmation">Type {expectedConfirmation} to confirm</Label><Input id="moderation-confirmation" className="mt-1" value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" /></div>}<Button variant={destructive ? 'destructive' : 'default'} disabled={reason.trim().length < 3 || (destructive && confirmation !== expectedConfirmation) || mutation.isPending} onClick={() => mutation.mutate({ itemId: decision.item.item_id, kind: decision.item.item_kind, action: decision.action, reason })}>{mutation.isPending ? 'Saving…' : 'Confirm action'}</Button></DialogContent></Dialog>
  </div>;
}
