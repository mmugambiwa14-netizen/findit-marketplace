import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, Loader2, Store, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InfoHint, { LabelWithHint } from '@/components/ui/info-hint';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import BusinessAccountPicker from '@/components/admin/BusinessAccountPicker';
import ListingDetailsStep from '@/components/create-listing/ListingDetailsStep';
import ListingLocationStep from '@/components/create-listing/ListingLocationStep';
import StepNav from '@/components/create-listing/StepNav';
import { useAuth } from '@/lib/AuthContext';
import { customerErrorMessage } from '@/lib/customerErrors';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { cn } from '@/lib/utils';
import { createBusinessListing, listManagedListingRequests } from '@/services/adminBusinessPublishingService';
import { removeStagedListingImage, uploadListingImage } from '@/services/listingCreationService';
import { seedListingSchemaValues } from '@/services/listingSchemaBinding';
import { getCategoryTaxonomy, groupPostableNodes, marketplaceRoots } from '@/services/taxonomyService';

// Services are advertised through a different table and boundary, so the
// listing composer covers the three marketplace listing kinds only.
const LISTING_KINDS = Object.freeze([
  ['property', 'Property'],
  ['car', 'Cars'],
  ['machinery', 'Machinery'],
]);
const STEP_LABELS = Object.freeze(['Business', 'Category', 'Details', 'Location', 'Photos', 'Publish']);

function freshForm() {
  return {
    submission_key: crypto.randomUUID(),
    country_code: LAUNCH_COUNTRY_CODE,
    currency: 'USD',
    contact_phone: '',
    contact_whatsapp: '',
    contact_email: '',
    detail: {},
  };
}

export default function AdminBusinessListings() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState(null);
  const [managedRequestId, setManagedRequestId] = useState('');
  const [formData, setFormData] = useState(freshForm);
  const [media, setMedia] = useState([]);
  const [reason, setReason] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);

  const update = (key, value) => setFormData((current) => ({ ...current, [key]: value }));

  const taxonomyQuery = useQuery({
    queryKey: ['public-category-taxonomy', LAUNCH_COUNTRY_CODE],
    queryFn: () => getCategoryTaxonomy(null, LAUNCH_COUNTRY_CODE),
    staleTime: 5 * 60 * 1000,
  });
  const managedQuery = useQuery({
    queryKey: ['admin-managed-listing-requests', 'accepted'],
    queryFn: () => listManagedListingRequests({ status: 'accepted' }),
    staleTime: 60 * 1000,
  });

  const taxonomy = taxonomyQuery.data ?? [];
  const rootsByKind = useMemo(
    () => new Map(marketplaceRoots(taxonomy).map((root) => [root.marketplaceKind, root])),
    [taxonomy],
  );

  // An admin may publish for an approved business, or against an accepted
  // managed listing request from an owner who never wanted a business account.
  const acceptedRequests = useMemo(
    () => (managedQuery.data ?? []).filter((row) => row.requester_user_id === account?.userId),
    [managedQuery.data, account?.userId],
  );
  const selectedRequest = acceptedRequests.find((row) => row.id === managedRequestId) ?? null;
  const publishableKinds = useMemo(() => {
    const approved = new Set(account?.approvedCategories ?? []);
    if (selectedRequest) approved.add(selectedRequest.category);
    return LISTING_KINDS.filter(([key]) => approved.has(key));
  }, [account?.approvedCategories, selectedRequest]);

  const grouped = useMemo(
    () => (formData.listing_category ? groupPostableNodes(taxonomy, formData.listing_category) : new Map()),
    [formData.listing_category, taxonomy],
  );
  const optionsByValue = useMemo(
    () => new Map([...grouped.values()].flat().map((option) => [option.value, option])),
    [grouped],
  );

  useEffect(() => {
    // Changing the account invalidates a category chosen under the previous one,
    // and a reason written about a different business.
    setFormData(freshForm());
    setMedia([]);
    setManagedRequestId('');
    setReason('');
  }, [account?.userId]);

  const chooseKind = (kind) => {
    update('listing_category', kind);
    update('type', kind);
    update('category', '');
    update('detail', {});
    update('taxonomy_binding', {});
    update('taxonomy_context', {});
  };

  const chooseCategory = (value) => {
    const option = optionsByValue.get(value);
    if (!option) {
      toast.error('That category is no longer available.');
      return;
    }
    try {
      const seed = seedListingSchemaValues(formData.listing_category, option.schemaBinding);
      update('category', option.value);
      update('taxonomy_binding', option.schemaBinding);
      update('taxonomy_context', seed.taxonomyDimensions);
      update('detail', seed.values);
      if (seed.offerType) update('listing_type', seed.offerType);
    } catch {
      toast.error('That category is not compatible with the current listing schema.');
    }
  };

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (media.length + files.length > 20) {
      toast.error('A listing can contain up to 20 images.');
      return;
    }
    for (const file of files) {
      try {
        const uploaded = await uploadListingImage(file);
        setMedia((current) => [...current, uploaded]);
      } catch (failure) {
        toast.error(customerErrorMessage(failure, 'IMAGE_UPLOAD_FAILED'));
      }
    }
  };

  const removeImage = async (item) => {
    try {
      await removeStagedListingImage(item.path);
      setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
    } catch (failure) {
      toast.error(customerErrorMessage(failure, 'IMAGE_UPLOAD_FAILED'));
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const result = await createBusinessListing({
        ownerUserId: account.userId,
        // The admin uploaded the photographs, so the storage paths carry the
        // admin's identity even though the business will own the listing.
        uploaderUserId: user.id,
        managedRequestId: managedRequestId || null,
        reason,
        submissionKey: formData.submission_key,
        kind: formData.listing_category,
        category: formData.category,
        listingType: formData.listing_type,
        title: formData.title,
        description: formData.description,
        price: formData.price,
        currency: formData.currency,
        negotiable: formData.negotiable,
        locationId: formData.location_id,
        contactPhone: formData.contact_phone,
        contactWhatsapp: formData.contact_whatsapp,
        contactEmail: formData.contact_email,
        detail: formData.detail,
        media,
      });
      setPublished({ ...result, businessName: account.fullName || account.email });
      toast.success('Listing published for the business.');
      await managedQuery.refetch();
    } catch (failure) {
      toast.error(failure.message || 'This listing could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  const startAnother = () => {
    setPublished(null);
    setFormData(freshForm());
    setMedia([]);
    setReason('');
    setManagedRequestId('');
    setStep(2);
  };

  if (published) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black">Listing published</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {published.businessName} now owns this listing and can manage it from their own account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={startAnother}>Publish another</Button>
            <Button variant="outline" onClick={() => { setPublished(null); setAccount(null); setStep(1); }}>
              Choose a different business
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Curated marketplace</p>
        <h1 className="mt-1 text-2xl font-black">Publish a listing for a business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The business owns what you publish here. Every publication is recorded in the audit log with your reason.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Publication steps">
        {STEP_LABELS.map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold',
              step === index + 1 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <BusinessAccountPicker
            selected={account}
            onSelect={setAccount}
            label="Which business is this listing for?"
            description="Search the account that will own the listing."
            inputId="listing-account-search"
          />

          {account && acceptedRequests.length > 0 ? (
            <div>
              <LabelWithHint
                htmlFor="managed-request"
                hintLabel="Managed listing request"
                hint={<p>Publishing against a request marks it published, and lets you publish a category the account is not approved for.</p>}
              >Accepted managed listing request (optional)</LabelWithHint>
              <select
                id="managed-request"
                className="mt-1 h-11 w-full rounded-xl border border-input bg-surface-secondary px-3.5"
                value={managedRequestId}
                onChange={(event) => setManagedRequestId(event.target.value)}
              >
                <option value="">Not a managed listing request</option>
                {acceptedRequests.map((row) => (
                  <option key={row.id} value={row.id}>{row.owner_name} · {row.category} · {row.city}</option>
                ))}
              </select>

            </div>
          ) : null}

          {account && publishableKinds.length === 0 ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              This account holds no approved publishing category. Onboard the business first, or select an accepted
              managed listing request.
            </p>
          ) : null}

          <StepNav
            showBack={false}
            onContinue={() => setStep(2)}
            disabled={!account || publishableKinds.length === 0}
          />
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <div className="flex items-center">
              <h2 className="text-xl font-bold">What is being advertised?</h2>
              <InfoHint label="Available categories">
                <p>Only categories this business may publish in are offered.</p>
              </InfoHint>
            </div>

          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {publishableKinds.map(([key, fallbackLabel]) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseKind(key)}
                className={cn(
                  'flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left',
                  formData.listing_category === key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                )}
              >
                <Store className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="font-semibold">{rootsByKind.get(key)?.label || fallbackLabel}</span>
              </button>
            ))}
          </div>

          {formData.listing_category ? (
            <div>
              <Label htmlFor="listing-taxonomy">Category</Label>
              <Select value={formData.category || ''} onValueChange={chooseCategory}>
                <SelectTrigger id="listing-taxonomy" className="mt-1 h-11 rounded-xl">
                  <SelectValue placeholder={taxonomyQuery.isLoading ? 'Loading categories…' : 'Choose a category'} />
                </SelectTrigger>
                <SelectContent>
                  {[...grouped.entries()].map(([group, options]) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <StepNav onBack={() => setStep(1)} onContinue={() => setStep(3)} disabled={!formData.category} />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <ListingDetailsStep
            formData={formData}
            update={update}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <ListingLocationStep
            formData={formData}
            update={update}
            onBack={() => setStep(3)}
            onContinue={() => setStep(5)}
          />
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <div>
            <div className="flex items-center">
              <h2 className="text-xl font-bold">Photos and contact</h2>
              <InfoHint label="Photos and contact">
                <p>You upload the photographs; the published listing shows the contact details the business wants buyers to use.</p>
                <p>At least one contact method is required.</p>
              </InfoHint>
            </div>
          </div>

          <label className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:border-primary/50">
            <Camera className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <span className="mt-2 text-sm font-semibold">Add listing images</span>
            <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP · 5 MB each · up to 20</span>
            <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} />
          </label>

          {media.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((item, index) => (
                <div key={item.path} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={item.previewUrl} alt={`Listing image ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute bottom-2 left-2 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Cover</span>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute right-2 top-2 h-9 w-9"
                    onClick={() => removeImage(item)}
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-4 border-t border-border pt-5">
            <div>
              <Label htmlFor="admin-contact-phone">Phone</Label>
              <Input id="admin-contact-phone" type="tel" maxLength={40} className="mt-1"
                value={formData.contact_phone || ''} onChange={(event) => update('contact_phone', event.target.value)} />
            </div>
            <div>
              <Label htmlFor="admin-contact-whatsapp">WhatsApp</Label>
              <Input id="admin-contact-whatsapp" type="tel" maxLength={40} className="mt-1"
                value={formData.contact_whatsapp || ''} onChange={(event) => update('contact_whatsapp', event.target.value)} />
            </div>
            <div>
              <Label htmlFor="admin-contact-email">Email</Label>
              <Input id="admin-contact-email" type="email" maxLength={254} className="mt-1"
                value={formData.contact_email || ''} onChange={(event) => update('contact_email', event.target.value)} />
            </div>
          </div>

          <StepNav
            onBack={() => setStep(4)}
            onContinue={() => setStep(6)}
            disabled={media.length === 0
              || !(formData.contact_phone || formData.contact_whatsapp || formData.contact_email)}
          />
        </section>
      ) : null}

      {step === 6 ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-xl font-bold">Publish for {account.fullName || account.email}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The listing goes live immediately and appears in the business&apos;s own listings.
            </p>
          </div>

          <dl className="grid gap-3 rounded-xl border border-border bg-background/45 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Title</dt><dd className="font-semibold">{formData.title}</dd></div>
            <div><dt className="text-muted-foreground">Category</dt><dd className="font-semibold">{formData.category}</dd></div>
            <div><dt className="text-muted-foreground">Price</dt><dd className="font-semibold">{formData.currency} {Number(formData.price || 0).toLocaleString()}</dd></div>
            <div><dt className="text-muted-foreground">Images</dt><dd className="font-semibold">{media.length}</dd></div>
            {selectedRequest ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Managed request</dt>
                <dd className="font-semibold">{selectedRequest.owner_name} · marks the request published</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <LabelWithHint
              htmlFor="publish-reason"
              hintLabel="Publication reason"
              hint={<p>Recorded in the admin audit log against this listing.</p>}
            >Why is PeekaListing publishing this?</LabelWithHint>
            <Textarea id="publish-reason" className="mt-1" rows={3} required minLength={3} maxLength={1000}
              placeholder="Stock captured at the dealership on behalf of the onboarded business"
              value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep(5)} disabled={publishing}>Back</Button>
            <Button onClick={publish} disabled={publishing || reason.trim().length < 3}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish for this business
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
