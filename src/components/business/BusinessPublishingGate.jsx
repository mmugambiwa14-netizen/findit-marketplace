import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, ClipboardList, Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getMyPublishingAccess,
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
  return <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Checking publishing access" /></main>;
}

function PublishingChoice({ access, onBusiness, onManaged }) {
  const pending = ['submitted', 'reviewing', 'needs_information'].includes(access?.applicationStatus);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Publish on PeekaListing</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Choose how you want to list</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Direct publishing is reserved for approved businesses. Owners who do not need a business account can ask PeekaListing to prepare and advertise a listing for them.</p>
      {pending && <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4"><p className="font-bold">Business application: {access.applicationStatus.replace('_', ' ')}</p>{access.reviewerMessage && <p className="mt-1 text-sm text-muted-foreground">{access.reviewerMessage}</p>}</div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ChoiceCard icon={Building2} title="Become an approved business" description="Apply for category-specific publishing rights and manage your own inventory, Peeks and buyer requests." action={pending ? 'View application' : 'Apply as a business'} onClick={onBusiness} />
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
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (category) => update('requestedCategories', form.requestedCategories.includes(category) ? form.requestedCategories.filter((item) => item !== category) : [...form.requestedCategories, category]);

  if (['submitted', 'reviewing'].includes(access?.applicationStatus)) return <StatusPage title="Application under review" description="You can continue using PeekaListing as a buyer. Direct publishing will unlock only after at least one requested category is approved." onBack={onBack} />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try { await submitBusinessApplication(form); toast.success('Business application submitted'); await onSubmitted(); onBack(); }
    catch (error) { toast.error(error.message || 'Application could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  return <main className="mx-auto max-w-2xl px-4 py-8"><button className="text-sm text-muted-foreground" onClick={onBack}>Back</button><h1 className="mt-4 text-3xl font-black">Business application</h1><p className="mt-2 text-sm text-muted-foreground">Approval is category-specific. You will only be able to publish in categories approved by PeekaListing.</p><form className="mt-6 space-y-4" onSubmit={submit}><Field label="Business name"><Input required value={form.businessName} onChange={(e) => update('businessName', e.target.value)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Contact person"><Input required value={form.contactName} onChange={(e) => update('contactName', e.target.value)} /></Field><Field label="City"><Input required value={form.city} onChange={(e) => update('city', e.target.value)} /></Field><Field label="Business email"><Input required type="email" value={form.businessEmail} onChange={(e) => update('businessEmail', e.target.value)} /></Field><Field label="Business phone"><Input required value={form.businessPhone} onChange={(e) => update('businessPhone', e.target.value)} /></Field></div><Field label="Business description"><Textarea required rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} /></Field><fieldset><legend className="text-sm font-bold">Requested categories</legend><div className="mt-2 grid grid-cols-2 gap-2">{CATEGORY_OPTIONS.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3"><input type="checkbox" checked={form.requestedCategories.includes(key)} onChange={() => toggleCategory(key)} />{label}</label>)}</div></fieldset><Button className="w-full" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</Button></form></main>;
}

function ManagedListingRequest({ onBack }) {
  const [form, setForm] = useState({ category: 'car', ownerName: '', contactEmail: '', contactPhone: '', countryCode: 'ZW', city: '', itemSummary: '', priceExpectation: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  if (submitted) return <StatusPage title="Advertising request received" description="PeekaListing will review the information before deciding whether to prepare and publish the listing. Submission does not guarantee acceptance." onBack={onBack} />;
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await submitManagedListingRequest(form); setSubmitted(true); } catch (error) { toast.error(error.message || 'Request could not be submitted.'); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-2xl px-4 py-8"><button className="text-sm text-muted-foreground" onClick={onBack}>Back</button><h1 className="mt-4 text-3xl font-black">Advertise through PeekaListing</h1><p className="mt-2 text-sm text-muted-foreground">PeekaListing may prepare and publish an approved listing on behalf of the owner. The owner remains responsible for the item and transaction.</p><form className="mt-6 space-y-4" onSubmit={submit}><Field label="Category"><select className="h-11 w-full rounded-xl border border-border bg-background px-3" value={form.category} onChange={(e) => update('category', e.target.value)}>{CATEGORY_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Owner name"><Input required value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} /></Field><Field label="City"><Input required value={form.city} onChange={(e) => update('city', e.target.value)} /></Field><Field label="Email"><Input required type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} /></Field><Field label="Phone"><Input required value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} /></Field></div><Field label="What do you want advertised?"><Textarea required rows={5} value={form.itemSummary} onChange={(e) => update('itemSummary', e.target.value)} /></Field><Field label="Expected price (optional)"><Input value={form.priceExpectation} onChange={(e) => update('priceExpectation', e.target.value)} /></Field><Button className="w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit advertising request'}</Button></form></main>;
}

function StatusPage({ title, description, onBack }) { return <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4"><section className="clay-card w-full rounded-2xl p-6 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><Button className="mt-5" variant="outline" onClick={onBack}>Back</Button></section></main>; }
function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}</span>{children}</label>; }
