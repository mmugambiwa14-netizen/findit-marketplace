import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  getMyManagedListingRequests,
  requestAdditionalBusinessCategories,
  respondToBusinessApplication,
} from '@/services/businessPublishingService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const CATEGORY_OPTIONS = [
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
  ['service', 'Services'],
];

const STATUS_LABELS = {
  submitted: 'Submitted',
  reviewing: 'Under review',
  accepted: 'Accepted',
  needs_information: 'More information needed',
  declined: 'Declined',
  published: 'Published',
  cancelled: 'Cancelled',
};

export default function PublishingOperationsPanel({ access, onRefresh }) {
  const [selected, setSelected] = useState([]);
  const [response, setResponse] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [managedRequests, setManagedRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // A suspended category is a moderation decision and is never requestable.
  const unavailable = useMemo(
    () => CATEGORY_OPTIONS.filter(([key]) => !access.approvedCategories.includes(key)
      && !access.pendingCategories.includes(key)
      && !access.suspendedCategories?.includes(key)),
    [access.approvedCategories, access.pendingCategories, access.suspendedCategories],
  );

  const loadManagedRequests = async () => {
    setLoadingRequests(true);
    try {
      setManagedRequests(await getMyManagedListingRequests());
    } catch (error) {
      toast.error(error.message || 'Managed listing requests could not be loaded.');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => { void loadManagedRequests(); }, []);

  const submitInformation = async () => {
    const message = response.trim();
    if (message.length < 5) {
      toast.error('Provide the requested information.');
      return;
    }
    setBusyAction('information');
    try {
      await respondToBusinessApplication(access.applicationId, message);
      setResponse('');
      toast.success('Information sent for review');
      await onRefresh?.();
    } catch (error) {
      toast.error(error.message || 'The information could not be submitted.');
    } finally {
      setBusyAction('');
    }
  };

  const requestCategories = async () => {
    if (selected.length === 0) return;
    setBusyAction('categories');
    try {
      await requestAdditionalBusinessCategories(selected);
      setSelected([]);
      toast.success('Additional category request submitted');
      await onRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Additional categories could not be requested.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-extrabold">Publishing access</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your existing approved categories remain available while other requests are reviewed.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORY_OPTIONS.map(([key, label]) => {
          const approved = access.approvedCategories.includes(key);
          const pending = access.pendingCategories.includes(key);
          const suspended = access.suspendedCategories?.includes(key);
          return (
            <div key={key} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-semibold">{label}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {approved ? <><CheckCircle2 className="h-4 w-4 text-primary" /> Approved</> : pending ? <><Clock3 className="h-4 w-4" /> Pending</> : suspended ? <><ShieldAlert className="h-4 w-4 text-destructive" /> Suspended</> : 'Not requested'}
              </span>
            </div>
          );
        })}
      </div>

      {access.applicationStatus === 'needs_information' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">PeekaListing needs more information</p>
              <p className="mt-1 text-sm text-muted-foreground">{access.reviewerMessage || 'Please provide the requested application information.'}</p>
            </div>
          </div>
          <label htmlFor="publishing-response" className="mt-3 block text-xs font-semibold">Response to PeekaListing</label>
          <Textarea id="publishing-response" className="mt-1" rows={4} minLength={5} maxLength={3000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Write your response" />
          <Button className="mt-3" onClick={submitInformation} disabled={busyAction === 'information' || response.trim().length < 5}>
            {busyAction === 'information' ? 'Sending…' : 'Send information'}
          </Button>
        </div>
      )}

      {unavailable.length > 0 && (
        <div>
          <h3 className="text-sm font-bold">Request another category</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {unavailable.map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
                <input type="checkbox" checked={selected.includes(key)} onChange={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />
                {label}
              </label>
            ))}
          </div>
          <Button className="mt-3" variant="outline" onClick={requestCategories} disabled={busyAction === 'categories' || selected.length === 0}>
            {busyAction === 'categories' ? 'Submitting…' : 'Request selected categories'}
          </Button>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Managed advertising requests</h3>
          <Button size="sm" variant="ghost" onClick={loadManagedRequests} disabled={loadingRequests}>Refresh</Button>
        </div>
        {loadingRequests ? (
          <ListRowsSkeleton rows={3} showThumbnail={false} className="mt-3" label="Loading managed advertising requests" />
        ) : managedRequests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No managed advertising requests yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {managedRequests.slice(0, 5).map((request) => (
              <article key={request.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold capitalize">{request.category}</p>
                    <p className="line-clamp-2 text-muted-foreground">{request.item_summary}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{STATUS_LABELS[request.status] || request.status}</span>
                </div>
                {request.reviewer_message && <p className="mt-2 rounded-lg bg-muted px-2 py-1.5 text-xs">{request.reviewer_message}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
