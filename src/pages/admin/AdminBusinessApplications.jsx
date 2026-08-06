import { useEffect, useState } from 'react';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  listBusinessApplications,
  reviewBusinessApplication,
  reviewBusinessCategory,
} from '@/services/adminBusinessPublishingService';

const STATUS_OPTIONS = ['', 'submitted', 'reviewing', 'needs_information', 'approved', 'rejected'];

export default function AdminBusinessApplications() {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [messages, setMessages] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listBusinessApplications({ status: status || null }));
    } catch (error) {
      toast.error(error.message || 'Applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status]);

  const actOnApplication = async (applicationId, action) => {
    const key = `application:${applicationId}`;
    setBusyKey(key);
    try {
      await reviewBusinessApplication(applicationId, action, messages[key] || '');
      toast.success('Application updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Application could not be updated.');
    } finally {
      setBusyKey('');
    }
  };

  const actOnCategory = async (applicationId, categoryId, action) => {
    const key = `category:${categoryId}`;
    setBusyKey(key);
    try {
      await reviewBusinessCategory(categoryId, action, messages[key] || '');
      toast.success('Category approval updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Category could not be updated.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Curated marketplace</p>
          <h1 className="mt-1 text-2xl font-black">Business applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review the business separately from each requested publishing category.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Refresh</Button>
      </header>

      <label className="block max-w-xs text-sm font-semibold">Status
        <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUS_OPTIONS.map((value) => <option key={value || 'all'} value={value}>{value ? value.replace('_', ' ') : 'All applications'}</option>)}
        </select>
      </label>

      {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : null}
      {!loading && rows.length === 0 ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No applications match this filter.</div> : null}

      <div className="space-y-4">
        {rows.map((application) => {
          const applicationKey = `application:${application.application_id}`;
          const categories = Array.isArray(application.requested_categories) ? application.requested_categories : [];
          return (
            <article key={application.application_id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h2 className="truncate text-lg font-extrabold">{application.business_name}</h2></div>
                  <p className="mt-1 text-sm text-muted-foreground">{application.contact_name} · {application.city}, {application.country_code}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{application.business_email} · {application.business_phone}</p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wide">{application.application_status.replace('_', ' ')}</span>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{application.description}</p>

              <div className="mt-5 space-y-3">
                {categories.map((category) => {
                  const categoryKey = `category:${category.id}`;
                  const busy = busyKey === categoryKey;
                  return (
                    <section key={category.id} className="rounded-xl border border-border bg-background/45 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-bold capitalize">{category.category}</p><p className="text-xs text-muted-foreground">Current status: {category.status}</p></div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => actOnCategory(application.application_id, category.id, 'approve')} disabled={busy}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => actOnCategory(application.application_id, category.id, 'reject')} disabled={busy}>Reject</Button>
                          {category.status === 'approved' ? <Button size="sm" variant="destructive" onClick={() => actOnCategory(application.application_id, category.id, 'suspend')} disabled={busy}>Suspend</Button> : null}
                        </div>
                      </div>
                      <Textarea className="mt-3" rows={2} placeholder="Required for rejection or suspension" value={messages[categoryKey] || ''} onChange={(event) => setMessages((current) => ({ ...current, [categoryKey]: event.target.value }))} />
                    </section>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-border p-4">
                <Textarea rows={2} placeholder="Message required when requesting information or rejecting the application" value={messages[applicationKey] || ''} onChange={(event) => setMessages((current) => ({ ...current, [applicationKey]: event.target.value }))} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => actOnApplication(application.application_id, 'start_review')} disabled={busyKey === applicationKey}>Start review</Button>
                  <Button variant="outline" onClick={() => actOnApplication(application.application_id, 'request_information')} disabled={busyKey === applicationKey}>Request information</Button>
                  <Button variant="destructive" onClick={() => actOnApplication(application.application_id, 'reject')} disabled={busyKey === applicationKey}>Reject application</Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
