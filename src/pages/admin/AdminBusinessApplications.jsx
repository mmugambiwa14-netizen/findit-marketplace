import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AdminQueryError from '@/components/admin/AdminQueryError';
import CursorPager from '@/components/admin/CursorPager';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  listBusinessApplications,
  reviewBusinessApplication,
  reviewBusinessCategory,
} from '@/services/adminBusinessPublishingService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';
import {
  ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS,
  adminStatusLabel,
  businessApplicationActions,
  businessCategoryActions,
} from '@/services/adminConfig';
import { useCursorStack } from '@/hooks/useCursorStack';

const PAGE_SIZE = 25;
export default function AdminBusinessApplications() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [messages, setMessages] = useState({});
  const loadSequence = useRef(0);
  const queryClient = useQueryClient();
  const pagination = useCursorStack();

  const load = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const nextPage = await listBusinessApplications({ status: status || null, limit: PAGE_SIZE, before: pagination.cursor });
      if (sequence === loadSequence.current) setPage(nextPage);
    } catch (error) {
      if (sequence === loadSequence.current) {
        setLoadError(error);
        toast.error(error.message || 'Applications could not be loaded.');
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, pagination.cursor]);

  const actOnApplication = async (applicationId, action) => {
      const key = `application:${applicationId}`;
    setBusyKey(key);
    try {
      await reviewBusinessApplication(applicationId, action, messages[key] || '');
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
      toast.success('Application updated');
      await load();
    } catch (error) {
      toast.error(error.message || 'Application could not be updated.');
    } finally {
      setBusyKey('');
    }
  };

  const actOnCategory = async (categoryId, action) => {
      const key = `category:${categoryId}`;
    setBusyKey(key);
    try {
      await reviewBusinessCategory(categoryId, action, messages[key] || '');
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
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
        <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={status} onChange={(event) => { setStatus(event.target.value); pagination.reset(); }}>
          {ADMIN_BUSINESS_APPLICATION_STATUS_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <AdminQueryError error={loadError} onRetry={load} message="Business applications could not be loaded." />
      {loading ? <ListRowsSkeleton rows={5} label="Loading business applications" /> : null}
      {!loading && page.items.length === 0 ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No applications match this filter.</div> : null}

      <div className="space-y-4">
        {page.items.map((application) => {
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
                <span className="rounded-full border border-border px-3 py-1 text-xs font-bold uppercase tracking-wide">{adminStatusLabel(application.application_status)}</span>
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
                          {businessCategoryActions(category.status).map((action) => <Button key={action.value} size="sm" variant={action.variant} onClick={() => actOnCategory(category.id, action.value)} disabled={busy || (action.requiresMessage && (messages[categoryKey] || '').trim().length < 3)}>{action.label}</Button>)}
                        </div>
                      </div>
                      <label htmlFor={`category-message-${category.id}`} className="sr-only">Message for {category.category} category review</label>
                      <Textarea id={`category-message-${category.id}`} className="mt-3" rows={2} placeholder="Required for rejection or suspension" value={messages[categoryKey] || ''} onChange={(event) => setMessages((current) => ({ ...current, [categoryKey]: event.target.value }))} />
                      {category.reviewerMessage && <p className="mt-2 text-xs text-muted-foreground">Reviewer note: {category.reviewerMessage}</p>}
                    </section>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-border p-4">
                <label htmlFor={`application-message-${application.application_id}`} className="sr-only">Application review message</label>
                <Textarea id={`application-message-${application.application_id}`} rows={2} placeholder="Message required when requesting information or rejecting the application" value={messages[applicationKey] || ''} onChange={(event) => setMessages((current) => ({ ...current, [applicationKey]: event.target.value }))} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {businessApplicationActions(application.application_status).map((action) => <Button key={action.value} variant={action.variant} onClick={() => actOnApplication(application.application_id, action.value)} disabled={busyKey === applicationKey || (action.requiresMessage && (messages[applicationKey] || '').trim().length < 3)}>{action.label}</Button>)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <CursorPager
        pageNumber={pagination.pageNumber}
        itemCount={page.items.length}
        itemLabel="applications"
        canGoBack={pagination.canGoBack}
        canGoForward={Boolean(page.nextCursor)}
        onBack={pagination.back}
        onForward={() => pagination.forward(page.nextCursor)}
      />
    </div>
  );
}
