import { useState } from 'react';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import BusinessAccountPicker from '@/components/admin/BusinessAccountPicker';
import { onboardBusiness } from '@/services/adminBusinessPublishingService';
import { INVENTORY_BANDS } from '@/services/adminBusinessOnboardingContracts';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

const CATEGORY_OPTIONS = Object.freeze([
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
  ['service', 'Services'],
]);

function emptyForm() {
  return {
    businessName: '',
    contactName: '',
    businessEmail: '',
    businessPhone: '',
    countryCode: LAUNCH_COUNTRY_CODE,
    city: '',
    description: '',
    websiteUrl: '',
    socialUrl: '',
    expectedInventoryBand: '1-10',
    note: '',
  };
}

/**
 * Onboards a business the operator signed up directly, rather than waiting for
 * it to apply through the public gate. When the account has already applied,
 * only the publishing decision is recorded and the business keeps the details
 * it wrote about itself, so the form collapses to the category choice.
 */
export default function AdminBusinessOnboardingPanel({ onOnboarded }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  const hasExistingApplication = Boolean(account?.applicationId);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleCategory = (key) => setCategories((current) => (
    current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
  ));

  const reset = () => {
    setAccount(null);
    setForm(emptyForm());
    setCategories([]);
  };

  const chooseAccount = (next) => {
    setAccount(next);
    setCategories([]);
    if (!next) {
      setForm(emptyForm());
      return;
    }
    setForm((current) => ({
      ...current,
      contactName: current.contactName || next.fullName || '',
      businessEmail: current.businessEmail || next.email || '',
      businessPhone: current.businessPhone || next.phone || '',
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!account) {
      toast.error('Choose the account to onboard.');
      return;
    }
    if (categories.length === 0) {
      toast.error('Choose at least one publishing category.');
      return;
    }
    setSaving(true);
    try {
      const result = await onboardBusiness({
        ...form,
        userId: account.userId,
        categories,
        hasExistingApplication,
      });
      toast.success(result.reusedExistingApplication
        ? 'Existing application approved for the chosen categories.'
        : 'Business onboarded and approved.');
      reset();
      setOpen(false);
      await onOnboarded?.();
    } catch (failure) {
      toast.error(failure.message || 'This business could not be onboarded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-3">
          <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="block text-lg font-extrabold">Onboard a business</span>
            <span className="block text-sm text-muted-foreground">
              Approve an account you signed up directly, without waiting for it to apply.
            </span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open ? (
        <form onSubmit={submit} className="space-y-5 border-t border-border p-5">
          <BusinessAccountPicker
            selected={account}
            onSelect={chooseAccount}
            label="Which account is this business?"
            description="The business signs in with this account, so it must already be registered."
            inputId="onboard-account-search"
          />

          {account ? (
            <>
              {hasExistingApplication ? (
                <p className="rounded-xl border border-border bg-background/45 p-3 text-sm text-muted-foreground">
                  This account already applied ({String(account.applicationStatus).replace(/_/g, ' ')}).
                  Its own business details are kept as submitted; choose the categories to approve.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="onboard-business-name">Business name</Label>
                    <Input id="onboard-business-name" className="mt-1" required minLength={2} maxLength={160}
                      value={form.businessName} onChange={(event) => update('businessName', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-contact-name">Contact name</Label>
                    <Input id="onboard-contact-name" className="mt-1" required minLength={2} maxLength={120}
                      value={form.contactName} onChange={(event) => update('contactName', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-business-email">Business email</Label>
                    <Input id="onboard-business-email" type="email" className="mt-1" required maxLength={254}
                      value={form.businessEmail} onChange={(event) => update('businessEmail', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-business-phone">Business phone</Label>
                    <Input id="onboard-business-phone" type="tel" className="mt-1" required maxLength={40}
                      value={form.businessPhone} onChange={(event) => update('businessPhone', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-city">City</Label>
                    <Input id="onboard-city" className="mt-1" required minLength={2} maxLength={120}
                      value={form.city} onChange={(event) => update('city', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-country">Country code</Label>
                    <Input id="onboard-country" className="mt-1" required pattern="[A-Za-z]{2}" maxLength={2}
                      value={form.countryCode} onChange={(event) => update('countryCode', event.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-inventory">Expected inventory</Label>
                    <select
                      id="onboard-inventory"
                      className="mt-1 h-11 w-full rounded-xl border border-input bg-surface-secondary px-3.5"
                      value={form.expectedInventoryBand}
                      onChange={(event) => update('expectedInventoryBand', event.target.value)}
                    >
                      {INVENTORY_BANDS.map((band) => <option key={band} value={band}>{band} adverts</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="onboard-website">Website (optional)</Label>
                    <Input id="onboard-website" type="url" className="mt-1" maxLength={300}
                      value={form.websiteUrl} onChange={(event) => update('websiteUrl', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="onboard-social">Social profile (optional)</Label>
                    <Input id="onboard-social" type="url" className="mt-1" maxLength={300}
                      value={form.socialUrl} onChange={(event) => update('socialUrl', event.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="onboard-description">What the business sells</Label>
                    <Textarea id="onboard-description" className="mt-1" rows={3} required minLength={20} maxLength={3000}
                      value={form.description} onChange={(event) => update('description', event.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">At least 20 characters.</p>
                  </div>
                </div>
              )}

              <fieldset>
                <legend className="text-sm font-semibold">Approve publishing in</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map(([key, label]) => {
                    const active = categories.includes(key);
                    const alreadyApproved = account.approvedCategories.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
                          active ? 'border-primary bg-primary/10' : 'border-border'
                        }`}
                      >
                        <input type="checkbox" checked={active} onChange={() => toggleCategory(key)} className="h-4 w-4" />
                        {label}
                        {alreadyApproved ? <span className="text-xs font-normal text-muted-foreground">(already approved)</span> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <Label htmlFor="onboard-note">Onboarding note</Label>
                <Textarea id="onboard-note" className="mt-1" rows={2} maxLength={1000}
                  placeholder="How this business was verified, and by whom"
                  value={form.note} onChange={(event) => update('note', event.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Stored on the review record and the audit log.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Onboard and approve
                </Button>
                <Button type="button" variant="outline" onClick={reset} disabled={saving}>Clear</Button>
              </div>
            </>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
