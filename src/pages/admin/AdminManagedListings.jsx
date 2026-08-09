import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  listManagedListingRequests,
  updateManagedListingRequest,
} from '@/services/adminBusinessPublishingService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const STATUSES = ['', 'submitted', 'reviewing', 'accepted', 'needs_information', 'declined', 'published', 'cancelled'];

export default function AdminManagedListings() {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [messages, setMessages] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listManagedListingRequests({ status: status || null }));
    } catch (error) {
      toast.error(error.message || 'Managed listing requests could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]);

  const update = async (row, nextStatus) => {
    setBusyId(row.id);
    try {
      await updateManagedListingRequest(row.id, nextStatus, messages[row.id] || '');
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
        <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUSES.map((value) => <option key={value || 'all'} value={value}>{value ? value.replace('_', ' ') : 'All requests'}</option>)}
        </select>
      </label>

      {loading && <ListRowsSkeleton rows={5} label="Loading managed listing requests" />}
      {!loading && rows.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No managed listing requests match this filter.</div>}

      <div className="space-y-4">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /><h2 className="text-lg font-extrabold">{row.owner_name}</h2></div>
                <p className="mt-1 text-sm text-muted-foreground capitalize">{row.category} · {row.city}, {row.country_code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.contact_email} · {row.contact_phone}</p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wide">{row.status.replace('_', ' ')}</span>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{row.item_summary}</p>
            {row.price_expectation && <p className="mt-2 text-sm"><span className="font-bold">Price expectation:</span> {row.price_expectation}</p>}
            {row.reviewer_message && <div className="mt-3 rounded-xl border border-border bg-background/45 p-3 text-sm">{row.reviewer_message}</div>}

            <label htmlFor={`managed-message-${row.id}`} className="sr-only">Message for managed listing request</label>
            <Textarea id={`managed-message-${row.id}`} className="mt-4" rows={2} placeholder="Required when requesting information or declining" value={messages[row.id] || ''} onChange={(event) => setMessages((current) => ({ ...current, [row.id]: event.target.value }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => update(row, 'reviewing')} disabled={busyId === row.id}>Start review</Button>
              <Button onClick={() => update(row, 'accepted')} disabled={busyId === row.id}>Accept</Button>
              <Button variant="outline" onClick={() => update(row, 'needs_information')} disabled={busyId === row.id}>Request information</Button>
              <Button variant="outline" onClick={() => update(row, 'published')} disabled={busyId === row.id}>Mark published</Button>
              <Button variant="destructive" onClick={() => update(row, 'declined')} disabled={busyId === row.id}>Decline</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
