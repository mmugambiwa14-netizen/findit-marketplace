import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AdminQueryError from '@/components/admin/AdminQueryError';
import CursorPager from '@/components/admin/CursorPager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  listManagedListingRequests,
  updateManagedListingRequest,
} from '@/services/adminBusinessPublishingService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  ADMIN_MANAGED_LISTING_STATUS_OPTIONS,
  adminStatusLabel,
  managedListingActions,
} from '@/services/adminConfig';
import { getAdminUsers } from '@/services/adminService';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 25;
export default function AdminManagedListings() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [messages, setMessages] = useState({});
  const [assignments, setAssignments] = useState({});
  const [reviewers, setReviewers] = useState([]);
  const loadSequence = useRef(0);
  const queryClient = useQueryClient();
  const pagination = useCursorStack();

  const load = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const nextPage = await listManagedListingRequests({ status: status || null, limit: PAGE_SIZE, before: pagination.cursor });
      if (sequence === loadSequence.current) setPage(nextPage);
    } catch (error) {
      if (sequence === loadSequence.current) {
        setLoadError(error);
        toast.error(error.message || 'Managed listing requests could not be loaded.');
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, pagination.cursor]);

  useEffect(() => {
    let mounted = true;
    getAdminUsers({ query: '', role: 'admin', status: 'active', limit: 100, cursor: null })
      .then((result) => { if (mounted) setReviewers(result.items || []); })
      .catch(() => { if (mounted) setReviewers([]); });
    return () => { mounted = false; };
  }, []);

  const update = async (row, nextStatus) => {
    setBusyId(row.id);
    try {
      await updateManagedListingRequest(row.id, nextStatus, messages[row.id] || '', assignments[row.id] || null);
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
      toast.success('Managed listing request updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Managed listing request could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Managed advertising</p>
          <h1 className="mt-1 text-2xl font-black">Managed listing requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review, accept and track listings PeekaListing prepares on behalf of owners.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Refresh</Button>
      </header>

      <label className="block max-w-xs text-sm font-semibold">Status
        <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value); pagination.reset(); }}>
           {ADMIN_MANAGED_LISTING_STATUS_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <AdminQueryError error={loadError} onRetry={load} message="Managed listing requests could not be loaded." />
      {loading && <ListRowsSkeleton rows={5} label="Loading managed listing requests" />}
      {!loading && page.items.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No managed listing requests match this filter.</div>}

      <div className="space-y-4">
        {page.items.map((row) => {
          const assignedReviewerId = assignments[row.id] ?? row.assigned_to ?? '';
          const knownAssignment = reviewers.some((reviewer) => reviewer.user_id === row.assigned_to);
          return (
          <article key={row.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><h2 className="text-lg font-extrabold">{row.owner_name}</h2></div>
                <p className="mt-1 text-sm text-muted-foreground capitalize">{row.category} · {row.city}, {row.country_code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.contact_email} · {row.contact_phone}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wide">{adminStatusLabel(row.status)}</span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">Request {String(row.id).slice(0, 8)} · received {row.created_at ? new Date(row.created_at).toLocaleString() : 'unknown'}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{row.item_summary}</p>
            {row.price_expectation && <p className="mt-2 text-sm"><span className="font-bold">Price expectation:</span> {row.price_expectation}</p>}
            {row.reviewer_message && <div className="mt-3 rounded-xl border border-border bg-background/45 p-3 text-sm">{row.reviewer_message}</div>}

            <label htmlFor={`managed-reviewer-${row.id}`} className="mt-4 block text-sm font-semibold">Assigned reviewer
              <select id={`managed-reviewer-${row.id}`} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={assignedReviewerId} onChange={(event) => setAssignments((current) => ({ ...current, [row.id]: event.target.value }))}>
                <option value="">{row.assigned_to ? 'Keep current assignment' : 'No reviewer assigned'}</option>
                {row.assigned_to && !knownAssignment && <option value={row.assigned_to}>Current assignment ({String(row.assigned_to).slice(0, 8)})</option>}
                {reviewers.map((reviewer) => <option key={reviewer.user_id} value={reviewer.user_id}>{reviewer.full_name || reviewer.email || reviewer.user_id.slice(0, 8)}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">The assignment is saved with the next workflow action.</span>
            </label>

            <label htmlFor={`managed-message-${row.id}`} className="sr-only">Message for managed listing request</label>
            <Textarea id={`managed-message-${row.id}`} className="mt-4" rows={2} placeholder="Required when requesting information or declining" value={messages[row.id] || ''} onChange={(event) => setMessages((current) => ({ ...current, [row.id]: event.target.value }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              {managedListingActions(row.status).map((action) => <Button key={action.value} variant={action.variant} onClick={() => update(row, action.value)} disabled={busyId === row.id || (action.requiresMessage && (messages[row.id] || '').trim().length < 3)}>{action.label}</Button>)}
            </div>
          </article>
          );
        })}
      </div>
      <CursorPager
        pageNumber={pagination.pageNumber}
        itemCount={page.items.length}
        itemLabel="requests"
        canGoBack={pagination.canGoBack}
        canGoForward={Boolean(page.nextCursor)}
        onBack={pagination.back}
        onForward={() => pagination.forward(page.nextCursor)}
      />
    </div>
  );
}
