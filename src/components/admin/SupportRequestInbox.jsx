import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Search } from 'lucide-react';
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
import { getAdminSupportRequests, resolveAdminSupportRequest } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const PAGE_SIZE = 20;
const categoryLabels = {
  account: 'Account', listing: 'Listing', report: 'Report', safety: 'Safety',
  technical: 'Technical', other: 'Other',
};

export default function SupportRequestInbox({ onShowReports }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('all');
  const pagination = useCursorStack();
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();
  const request = { query, status, category, limit: PAGE_SIZE, cursor: pagination.cursor };
  const supportQuery = useQuery({
    queryKey: ['admin-support-requests', request],
    queryFn: () => getAdminSupportRequests(request),
  });
  const mutation = useMutation({
    mutationFn: resolveAdminSupportRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
      setSelected(null);
      setNote('');
      toast.success('Support request resolved');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const data = supportQuery.data ?? { items: [], nextCursor: null };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-bold">Support requests</h1>
            <p className="mt-1 text-muted-foreground">The lightweight founder inbox. There is no customer ticket portal or chat.</p>
          </div>
          <Button variant="outline" onClick={onShowReports}>Marketplace reports</Button>
        </div>

        <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search support requests" className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); pagination.reset(); }} placeholder="Reference, email, or message" /></div>
          <Select value={status} onValueChange={(value) => { setStatus(value); pagination.reset(); }}><SelectTrigger aria-label="Filter support requests by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent></Select>
          <Select value={category} onValueChange={(value) => { setCategory(value); pagination.reset(); }}><SelectTrigger aria-label="Filter support requests by category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        </CardContent></Card>

        {supportQuery.error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{supportQuery.error.message}</p>}
        {supportQuery.isLoading ? (
          <Card className="p-4"><ListRowsSkeleton rows={6} label="Loading support requests" /></Card>
        ) : data.items.length === 0 ? (
          <Card className="p-10 text-center"><Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground" /><p className="text-muted-foreground">No support requests match these filters.</p></Card>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <Card key={item.request_id}><CardContent className="pt-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-semibold">{item.reference_id}</p><Badge variant="outline">{categoryLabels[item.category] ?? item.category}</Badge><Badge variant={item.status === 'open' ? 'default' : 'secondary'}>{item.status}</Badge></div>
                    <p className="text-sm text-muted-foreground">{item.contact_email} · {new Date(item.created_at).toLocaleString()}</p>
                    {item.related_reference && <p className="text-sm"><span className="text-muted-foreground">Related:</span> {item.related_reference}</p>}
                    <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{item.message}</p>
                    {item.admin_note && <p className="text-sm text-muted-foreground">Resolution note: {item.admin_note}</p>}
                  </div>
                  {item.status === 'open' && <Button className="shrink-0" variant="outline" onClick={() => { setSelected(item); setNote(''); }}>Resolve</Button>}
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}

        <CursorPager pageNumber={pagination.pageNumber} itemCount={data.items.length} itemLabel="requests" canGoBack={pagination.canGoBack} canGoForward={Boolean(data.nextCursor)} onBack={pagination.back} onForward={() => pagination.forward(data.nextCursor)} />
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve {selected?.reference_id}</DialogTitle></DialogHeader>
          <div><Label htmlFor="support-resolution-note">Resolution note</Label><Textarea id="support-resolution-note" className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record what was done and why" /></div>
          <Button disabled={note.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate({ requestId: selected.request_id, note })}>{mutation.isPending ? 'Saving…' : 'Mark resolved'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
