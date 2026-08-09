import { cloneElement, createContext, isValidElement, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import BackButton from '@/components/layout/BackButton';
import {
  getMyPublishingAccess,
  requestAdditionalBusinessCategories,
  respondToBusinessApplication,
  submitBusinessApplication,
  submitManagedListingRequest,
} from '@/services/businessPublishingService';

const PublishingAccessContext = createContext(null);
const CATEGORY_OPTIONS = [
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
  ['service', 'Services'],
];

export function usePublishingAccess() {
  return useContext(PublishingAccessContext);
}

export default function BusinessPublishingGate({ children }) {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setAccess(await getMyPublishingAccess());
    } catch (error) {
      toast.error(error.message || 'Publishing access could not be checked.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  const value = useMemo(() => ({ access, refresh }), [access]);

  if (loading) return <GateLoading />;
  if (access?.approvedCategories?.length > 0) {
    return <PublishingAccessContext.Provider value={value}>{children}</PublishingAccessContext.Provider>;
  }
  if (mode === 'business') return <BusinessApplication access={access} onBack={() => setMode(null)} onSubmitted={refresh} />;
  if (mode === 'managed') return <ManagedListingRequest onBack={() => setMode(null)} />;
  return <PublishingChoice access={access} onBusiness={() => setMode('business')} onManaged={() => setMode('managed')} />;
}

function GateLoading() {
  return <main className="relative mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4"><BackButton className="absolute left-4 top-4" fallback="/" label="Back to Discover" /><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Checking publishing access" /></main>;
}

function PublishingChoice({ access, onBusiness, onManaged }) {
  const pending = ['submitted', 'reviewing', 'needs_information'].includes(access?.applicationStatus);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton className="-ml-2 mb-4" fallback="/" label="Back to Discover" />
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Publish on PeekaListing</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Choose how you want to list</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Direct publishing is available to approved businesses. If you are listing an item personally, you can ask PeekaListing to prepare and advertise it for you.</p>
      {pending && <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4"><p className="font-bold">Business application: {access.applicationStatus.replace('_', ' ')}</p>{access.reviewerMessage && <p className="mt-1 text-sm text-muted-foreground">{access.reviewerMessage}</p>}</div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ChoiceCard icon={Building2} title="Become an approved business" description="Apply to publish directly in selected categories and manage your inventory, Peeks and buyer requests." action={pending ? 'View application' : 'Apply as a business'} onClick={onBusiness} />
        <ChoiceCard icon={Megaphone} title="Advertise through PeekaListing" description="Send us the item details. PeekaListing reviews, prepares and publishes the listing on behalf of the owner." action="Request a managed listing" onClick={onManaged} />
      </div>
    </main>
  );
}

function ChoiceCard({ icon: Icon, title, description, action, onClick }) {
  return <section className="clay-card flex flex-col rounded-2xl p-5"><span className="locked-icon-tile h-12 w-12"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-xl font-extrabold">{title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p><Button className="mt-5" onClick={onClick}>{action}</Button></section>;
}

function BusinessApplication({ access, onBack, onSubmitted }) {
  const [form, setForm] = useState({ businessName: '', contactName: '', businessEmail: '', businessPhone: '', countryCode: 'ZW', city: '', description: '', websiteUrl: '', socialUrl: '', expectedInventoryBand: '1-10', requestedCategories: [] });
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (category) => update('requestedCategories', form.requestedCategories.includes(category) ? form.requestedCategories.filter((item) => item !== category) : [...form.requestedCategories, category]);

  if (access?.applicationStatus === 'needs_information') {
    const submitResponse = async (event) => {
      event.preventDefault();
      setSubmitting(true);
      try {
        await respondToBusinessApplication(access.applicationId, response);
        toast.success('Information sent for review');
        await onSubmitted();
        onBack();
      } catch (error) {
        toast.error(error.message || 'Your response could not be submitted.');
      } finally {
        setSubmitting(false);
      }
    };
    return <main className="mx-auto max-w-2xl px-4 py-8"><button type="button" className="text-sm text-muted-foreground" onClick={onBack}>Back</button><h1 className="mt-4 text-3xl font-black">More information required</h1><div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">{access.reviewerMessage || 'PeekaListing requested more information about your application.'}</div><form className="mt-5 space-y-4" onSubmit={submitResponse}><Field label="Your response"><Textarea required minLength={5} maxLength={3000} rows={6} value={response} onChange={(event) => setResponse(event.target.value)} /></Field><Button className="w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send information'}</Button></form></main>;
  }

  if (['submitted', 'reviewing'].includes(access?.applicationStatus)) return <StatusPage title="Application under review" description="You can continue using PeekaListing as a buyer. Direct publishing will unlock only after at least one requested category is approved." onBack={onBack} />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try { await submitBusinessApplication(form); toast.success('Business application submitted'); await onSubmitted(); onBack(); }
    catch (error) { toast.error(error.message || 'Application could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  return <main className="mx-auto max-w-2xl px-4 py-8"><button type="button" className="text-sm text-muted-foreground" onClick={onBack}>Back</button><h1 className="mt-4 text-3xl font-black">Business application</h1><p className="mt-2 text-sm text-muted-foreground">Approval is category-specific. You will only be able to publish in categories approved by PeekaListing.</p><form className="mt-6 space-y-4" onSubmit={submit}><Field label="Business name"><Input required minLength={2} maxLength={160} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Contact person"><Input required minLength={2} maxLength={120} value={form.contactName} onChange={(e) => update('contactName', e.target.value)} /></Field><Field label="City"><Input required minLength={2} maxLength={120} value={form.city} onChange={(e) => update('city', e.target.value)} /></Field><Field label="Business email"><Input required type="email" value={form.businessEmail} onChange={(e) => update('businessEmail', e.target.value)} /></Field><Field label="Business phone"><Input required value={form.businessPhone} onChange={(e) => update('businessPhone', e.target.value)} /></Field><Field label="Country code"><Input required pattern="[A-Za-z]{2}" maxLength={2} value={form.countryCode} onChange={(e) => update('countryCode', e.target.value.toUpperCase())} /></Field><Field label="Expected active listings"><select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={form.expectedInventoryBand} onChange={(e) => update('expectedInventoryBand', e.target.value)}><option value="1-10">1–10</option><option value="11-50">11–50</option><option value="51-200">51–200</option><option value="200+">200+</option></select></Field></div><Field label="Business description"><Textarea required minLength={20} maxLength={3000} rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Website (optional)"><Input type="url" value={form.websiteUrl} onChange={(e) => update('websiteUrl', e.target.value)} /></Field><Field label="Social profile (optional)"><Input type="url" value={form.socialUrl} onChange={(e) => update('socialUrl', e.target.value)} /></Field></div><fieldset><legend className="text-sm font-bold">Requested categories</legend><div className="mt-2 grid grid-cols-2 gap-2">{CATEGORY_OPTIONS.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3"><input type="checkbox" checked={form.requestedCategories.includes(key)} onChange={() => toggleCategory(key)} />{label}</label>)}</div></fieldset><Button className="w-full" disabled={submitting || form.requestedCategories.length === 0}>{submitting ? 'Submitting…' : 'Submit application'}</Button></form></main>;
}

export function AdditionalCategoryRequest({ access, onComplete }) {
  // A suspended category is a moderation decision and is never requestable.
  const unavailable = CATEGORY_OPTIONS.filter(([key]) => !access.approvedCategories.includes(key)
    && !access.pendingCategories.includes(key)
    && !access.suspendedCategories?.includes(key));
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  if (unavailable.length === 0) return null;
  const submit = async () => {
    setBusy(true);
    try {
      await requestAdditionalBusinessCategories(selected);
      toast.success('Additional category request submitted');
      await onComplete?.();
      setSelected([]);
    } catch (error) {
      toast.error(error.message || 'Additional categories could not be requested.');
    } finally {
      setBusy(false);
    }
  };
  return <section className="mt-5 rounded-2xl border border-border bg-card p-4"><h2 className="font-extrabold">Request another category</h2><p className="mt-1 text-sm text-muted-foreground">Each category is reviewed separately before publishing is enabled.</p><div className="mt-3 grid grid-cols-2 gap-2">{unavailable.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3"><input type="checkbox" checked={selected.includes(key)} onChange={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}</div><Button className="mt-3" onClick={submit} disabled={busy || selected.length === 0}>{busy ? 'Submitting…' : 'Request categories'}</Button></section>;
}

function ManagedListingRequest({ onBack }) {
  const [form, setForm] = useState({ category: 'car', ownerName: '', contactEmail: '', contactPhone: '', countryCode: 'ZW', city: '', itemSummary: '', priceExpectation: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  if (submitted) return <StatusPage title="Advertising request received" description="PeekaListing will review the information before deciding whether to prepare and publish the listing. Submission does not guarantee acceptance." onBack={onBack} />;
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await submitManagedListingRequest(form); setSubmitted(true); } catch (error) { toast.error(error.message || 'Request could not be submitted.'); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-2xl px-4 py-8"><button type="button" className="text-sm text-muted-foreground" onClick={onBack}>Back</button><h1 className="mt-4 text-3xl font-black">Advertise through PeekaListing</h1><p className="mt-2 text-sm text-muted-foreground">PeekaListing may prepare and publish an approved listing on behalf of the owner. The owner remains responsible for the item and transaction.</p><form className="mt-6 space-y-4" onSubmit={submit}><Field label="Category"><select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={form.category} onChange={(e) => update('category', e.target.value)}>{CATEGORY_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Owner name"><Input required minLength={2} maxLength={160} value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} /></Field><Field label="City"><Input required minLength={2} maxLength={120} value={form.city} onChange={(e) => update('city', e.target.value)} /></Field><Field label="Email"><Input required type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} /></Field><Field label="Phone"><Input required value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} /></Field><Field label="Country code"><Input required pattern="[A-Za-z]{2}" maxLength={2} value={form.countryCode} onChange={(e) => update('countryCode', e.target.value.toUpperCase())} /></Field></div><Field label="What do you want advertised?"><Textarea required minLength={20} maxLength={5000} rows={5} value={form.itemSummary} onChange={(e) => update('itemSummary', e.target.value)} /></Field><Field label="Expected price (optional)"><Input value={form.priceExpectation} onChange={(e) => update('priceExpectation', e.target.value)} /></Field><Button className="w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit advertising request'}</Button></form></main>;
}

function StatusPage({ title, description, onBack }) { return <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4"><section className="clay-card w-full rounded-2xl p-6 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><Button className="mt-5" variant="outline" onClick={onBack}>Back</Button></section></main>; }
function Field({ label, id = null, children }) {
  const fieldId = id || `publishing-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const control = isValidElement(children) ? cloneElement(children, { id: children.props.id || fieldId }) : children;
  return <div className="block"><label htmlFor={fieldId} className="mb-1.5 block text-sm font-bold">{label}</label>{control}</div>;
}
