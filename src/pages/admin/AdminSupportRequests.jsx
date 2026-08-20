import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
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
import { getAdminSupportRequests, resolveAdminSupportRequest } from '@/services/adminService';
import { ListRowsSkeleton, TableRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import { AdminMobileList, AdminMobileRecord } from '@/components/admin/AdminMobileRecord';

const PAGE_SIZE = 25;
const CATEGORIES = ['all', 'account', 'listing', 'report', 'safety', 'technical', 'other'];

function maskEmail(value) {
  const email = String(value || '').trim();
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'Not supplied';
  return `${name.slice(0, 2)}${name.length > 2 ? '***' : ''}@${domain}`;
}

export default function AdminSupportRequests() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('all');
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const pagination = useCursorStack();
  const queryClient = useQueryClient();
  const request = { query: debouncedQuery, status, category, limit: PAGE_SIZE, cursor: pagination.cursor };
  const support = useQuery({
    queryKey: ['admin-support', request],
    queryFn: () => getAdminSupportRequests(request),
    placeholderData: (previous) => previous,
  });
  const resolve = useMutation({
    mutationFn: resolveAdminSupportRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
      setDecision(null);
      setNote('');
      toast.success('Support request resolved');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const data = support.data || { items: [], nextCursor: null };

  return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <h1 className="text-3xl font-bold">Support requests</h1>
          <p className="mt-1 text-muted-foreground">Review customer requests and record how each case was resolved.</p>
        </header>
        <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search support requests" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Reference, email or message" /></div>
          <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter support requests by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select>
          <Select value={category} onValueChange={(value) => { setCategory(value); pagination.reset(); }}><SelectTrigger aria-label="Filter support requests by category"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item === 'all' ? 'All categories' : item[0].toUpperCase() + item.slice(1)}</SelectItem>)}</SelectContent></Select>
        </CardContent></Card>
        {support.error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"><p>{support.error.message}</p>{support.error.correlationId && <p className="mt-1 text-xs opacity-80">Reference: {support.error.correlationId}</p>}<Button className="mt-3" size="sm" variant="outline" onClick={() => support.refetch()}>Try again</Button></div>}
        <AdminMobileList label="Support requests">
          {support.isLoading ? <Card className="p-4"><ListRowsSkeleton rows={5} label="Loading support requests" /></Card> : data.items.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">No support requests match these filters.</Card> : data.items.map((item) => <AdminMobileRecord key={item.request_id} heading={item.reference_id || item.request_id} summary={<span className="whitespace-pre-wrap">{item.message}</span>} badges={<Badge variant={item.status === 'open' ? 'destructive' : 'secondary'}>{item.status}</Badge>} fields={[{ label: 'Customer', value: maskEmail(item.contact_email), wide: true }, { label: 'Category', value: item.category }, { label: 'Received', value: new Date(item.created_at).toLocaleString(), wide: true }, { label: 'Related', value: item.related_reference, wide: true }, { label: 'Resolution', value: item.admin_note, wide: true }]} actions={item.status === 'open' ? <Button className="min-h-11 w-full" size="sm" onClick={() => { setDecision(item); setNote(''); }}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve request</Button> : <span className="text-xs text-muted-foreground">Completed</span>} />)}
        </AdminMobileList>
        <Card className="hidden overflow-hidden md:block"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="p-3">Request</th><th className="p-3">Customer</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Received</th><th className="p-3">Action</th></tr></thead><tbody>
          {support.isLoading ? <TableRowsSkeleton columns={6} label="Loading support requests" /> : data.items.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No support requests match these filters.</td></tr> : data.items.map((item) => <tr key={item.request_id} className="border-b align-top last:border-0"><td className="max-w-md p-3"><p className="font-semibold">{item.reference_id || item.request_id}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.message}</p>{item.related_reference && <p className="mt-2 text-xs text-muted-foreground">Related: {item.related_reference}</p>}{item.admin_note && <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs">Resolution: {item.admin_note}</p>}</td><td className="p-3"><p>{maskEmail(item.contact_email)}</p><p className="mt-1 text-xs text-muted-foreground">ID {String(item.user_id || 'guest').slice(0, 8)}</p></td><td className="p-3 capitalize">{item.category}</td><td className="p-3"><Badge variant={item.status === 'open' ? 'destructive' : 'secondary'}>{item.status}</Badge></td><td className="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td><td className="p-3">{item.status === 'open' ? <Button size="sm" onClick={() => { setDecision(item); setNote(''); }}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve</Button> : <span className="text-xs text-muted-foreground">Completed</span>}</td></tr>)}
        </tbody></table></div></Card>
        <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="requests" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
      </div>
      <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !resolve.isPending) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle>Resolve support request</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Record the action taken. This note is written to the audit trail.</p><div><Label htmlFor="support-resolution-note">Resolution note</Label><Textarea id="support-resolution-note" className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain what was checked and how the request was resolved" /></div><Button disabled={note.trim().length < 3 || resolve.isPending} onClick={() => resolve.mutate({ requestId: decision.request_id, note })}>{resolve.isPending ? 'Resolving…' : 'Confirm resolution'}</Button></DialogContent></Dialog>
    </div>
  );
}
