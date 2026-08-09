import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Camera, CheckCircle2, Film, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PRICING_TYPES } from "@/lib/serviceConstants";
import { getSupportedListingCurrencies, LAUNCH_COUNTRY_CODE } from "@/lib/marketConfig";
import { goBackOrHome } from "@/lib/navigation";
import { customerErrorMessage } from "@/lib/customerErrors";
import { usePersistentFormDraft } from "@/hooks/usePersistentFormDraft";
import { createService } from "@/services/servicesService";
import { getCategoryTaxonomy } from "@/services/taxonomyService";
import { getActiveLocations } from "@/services/locationsService";
import { removeStagedMarketplaceImage, uploadMarketplaceImage } from "@/services/marketplaceImagesService";
import TourUploader from "@/components/tours/TourUploader";
import TourUploadProgress from "@/components/tours/TourUploadProgress";
import { removeListingTour, uploadListingTour } from "@/services/listingToursService";

function freshServiceForm(user) {
  return {
    title: "",
    description: "",
    category: "",
    subcategory: "",
    subcategories: [],
    price: "",
    currency: "USD",
    pricing_type: "starting_from",
    country_code: LAUNCH_COUNTRY_CODE,
    location_name: "",
    can_travel: false,
    contact_phone: user?.phone || "",
    contact_whatsapp: "",
    contact_email: user?.email || "",
  };
}

function buildServiceSpecializationGroups(taxonomy, selectedDomain) {
  if (!selectedDomain) return [];
  const groups = new Map();
  for (const node of taxonomy) {
    if (
      node.marketplaceKind !== "service"
      || node.nodeType !== "category"
      || !node.isPostable
      || node.supersededBy
      || node.depth <= selectedDomain.depth
      || node.pathSlugs[selectedDomain.depth] !== selectedDomain.canonicalSlug
    ) continue;
    const path = node.pathLabels.slice(selectedDomain.depth + 1, -1);
    const label = path.length ? path.join(" / ") : "Services";
    const current = groups.get(label) || [];
    current.push(node);
    groups.set(label, current);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

export default function CreateService() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imageInputRef = useRef(null);
  const draftKey = user?.id ? `findit_service_draft_v1_${user.id}` : null;
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tourDraft, setTourDraft] = useState(null);
  const [tourProgress, setTourProgress] = useState(null);
  const [tourBusy, setTourBusy] = useState(false);
  const [publishedService, setPublishedService] = useState(null);
  const [retryingTour, setRetryingTour] = useState(false);
  const [discardingTour, setDiscardingTour] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [form, setForm] = useState(() => freshServiceForm(user));
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const marketCountry = String(form.country_code || LAUNCH_COUNTRY_CODE).toUpperCase();

  const taxonomyQuery = useQuery({
    queryKey: ["public-category-taxonomy", "service", marketCountry],
    queryFn: () => getCategoryTaxonomy("service", marketCountry),
    staleTime: 5 * 60 * 1000,
  });
  const locationsQuery = useQuery({
    queryKey: ["locations", "city", marketCountry],
    queryFn: () => getActiveLocations("city", null, marketCountry),
    staleTime: 5 * 60 * 1000,
  });

  const taxonomy = taxonomyQuery.data || [];
  const serviceRoot = useMemo(
    () => taxonomy.find((node) => node.marketplaceKind === "service" && node.depth === 0 && node.nodeType === "group") || null,
    [taxonomy],
  );
  const serviceDomains = useMemo(
    () => serviceRoot
      ? taxonomy
        .filter((node) => node.parentId === serviceRoot.id && node.nodeType === "group" && !node.supersededBy)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
      : [],
    [serviceRoot, taxonomy],
  );
  const selectedCategory = useMemo(
    () => serviceDomains.find((category) => category.stableSlug === form.category) || null,
    [form.category, serviceDomains],
  );
  const specializationGroups = useMemo(
    () => buildServiceSpecializationGroups(taxonomy, selectedCategory),
    [selectedCategory, taxonomy],
  );
  const validSpecializationSlugs = useMemo(
    () => new Set(specializationGroups.flatMap((group) => group.items.map((item) => item.stableSlug))),
    [specializationGroups],
  );
  const cities = locationsQuery.data || [];
  const currencies = getSupportedListingCurrencies(marketCountry);

  const restoreDraft = useCallback((payload) => {
    if (payload?.form) {
      setForm({
        ...freshServiceForm(user),
        ...payload.form,
        country_code: String(payload.form.country_code || LAUNCH_COUNTRY_CODE).toUpperCase(),
        subcategories: Array.isArray(payload.form.subcategories) ? payload.form.subcategories : [],
      });
    }
    if (Array.isArray(payload?.media)) setMedia(payload.media);
    setSameAsPhone(Boolean(payload?.sameAsPhone));
  }, [user]);

  const draftValue = useMemo(() => ({
    form,
    media: media.map((item) => ({ ...item })),
    sameAsPhone,
  }), [form, media, sameAsPhone]);

  const { draftReady, saveNow, clearDraft } = usePersistentFormDraft({
    storageKey: draftKey,
    value: draftValue,
    onRestore: restoreDraft,
    enabled: !publishedService,
  });

  useEffect(() => {
    if (!draftReady || !user) return;
    setForm((current) => ({
      ...current,
      contact_phone: current.contact_phone || user.phone || "",
      contact_email: current.contact_email || user.email || "",
    }));
  }, [draftReady, user]);

  useEffect(() => {
    if (!taxonomyQuery.data || !form.category) return;
    if (!serviceDomains.some((domain) => domain.stableSlug === form.category)) {
      setForm((current) => ({ ...current, category: "", subcategory: "", subcategories: [] }));
    }
  }, [form.category, serviceDomains, taxonomyQuery.data]);

  useEffect(() => {
    if (!selectedCategory || !form.subcategories.length) return;
    const retained = form.subcategories.filter((slug) => validSpecializationSlugs.has(slug));
    if (retained.length !== form.subcategories.length) {
      setForm((current) => ({
        ...current,
        subcategories: retained,
        subcategory: retained[0] || "",
      }));
    }
  }, [form.subcategories, selectedCategory, validSpecializationSlugs]);

  useEffect(() => () => {
    if (tourDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
  }, [tourDraft?.previewUrl]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const priceDisabled = ["quote", "quote_required", "contact_for_price"].includes(form.pricing_type);
  const isDirty = Boolean(form.title || form.description || form.category || media.length || tourDraft);

  useEffect(() => {
    const warn = (event) => {
      if (isDirty && !publishedService) {
        saveNow();
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, publishedService, saveNow]);

  const handlePhoneChange = (value) => {
    setForm((current) => ({
      ...current,
      contact_phone: value,
      contact_whatsapp: sameAsPhone ? value : current.contact_whatsapp,
    }));
  };

  const toggleSameAsPhone = (checked) => {
    setSameAsPhone(checked);
    if (checked) update("contact_whatsapp", form.contact_phone || "");
  };

  const toggleSubcategory = (value) => {
    if (!validSpecializationSlugs.has(value)) return;
    setForm((current) => {
      const exists = current.subcategories.includes(value);
      const next = exists
        ? current.subcategories.filter((subcategory) => subcategory !== value)
        : [...current.subcategories, value];
      return { ...current, subcategories: next, subcategory: next[0] || "" };
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const service = await createService(form, user, media);
      const shouldUploadTour = Boolean(tourDraft?.file);
      if (!shouldUploadTour) return { service, tourError: null, tourQueued: false };
      try {
        await uploadListingTour({
          parentType: 'service',
          parentId: service.id,
          file: tourDraft.file,
          durationSeconds: tourDraft.durationSeconds,
          idempotencyKey: tourDraft.idempotencyKey,
        }, {
          resumeUpload: tourDraft.resumeUpload,
          onProgress: setTourProgress,
        });
        return { service, tourError: null, tourQueued: true };
      } catch (tourError) {
        return { service, tourError, tourQueued: false };
      }
    },
    onSuccess: ({ service, tourError, tourQueued }) => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["my-services", user.id] });
      if (tourError) {
        const failedDraft = {
          ...tourDraft,
          status: 'error',
          error: customerErrorMessage(tourError, 'TOUR_UPLOAD_FAILED'),
          resumeUpload: tourError.resumeUpload || tourDraft?.resumeUpload || null,
        };
        setTourDraft(failedDraft);
        setPublishedService(service);
        toast.warning('Service published. Resume the Peek upload from this screen.');
        return;
      }
      if (tourDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
      toast.success(tourQueued ? "Service published and Peek queued" : "Service published");
      navigate(`/service/${service.id}`);
    },
    onError: (error) => toast.error(customerErrorMessage(error, 'LISTING_PUBLISH_FAILED')),
  });

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (media.length + files.length > 6) {
      setMediaError('A service can contain up to 6 images.');
      return;
    }
    setUploading(true);
    setMediaError('');
    for (const file of files) {
      try {
        const uploaded = await uploadMarketplaceImage(file, 'service_photo');
        setMedia((current) => [...current, uploaded]);
      } catch (error) {
        setMediaError(customerErrorMessage(error, 'IMAGE_UPLOAD_FAILED'));
      }
    }
    setUploading(false);
  };

  const removeImage = async (item) => {
    try {
      await removeStagedMarketplaceImage(item.path, 'service_photo');
      setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
    } catch (error) {
      setMediaError(customerErrorMessage(error, 'IMAGE_UPLOAD_FAILED'));
    }
  };

  const canSubmit = Boolean(
    form.title.trim().length >= 3
    && form.title.trim().length <= 160
    && form.description.trim().length <= 5000
    && selectedCategory
    && form.subcategories.length
    && form.subcategories.every((slug) => validSpecializationSlugs.has(slug))
    && (form.contact_phone.trim() || form.contact_whatsapp.trim()),
  );

  const resumePublishedTour = async () => {
    if (!publishedService?.id || !tourDraft?.file) return;
    setRetryingTour(true);
    setTourProgress(null);
    try {
      await uploadListingTour({
        parentType: 'service',
        parentId: publishedService.id,
        file: tourDraft.file,
        durationSeconds: tourDraft.durationSeconds,
        idempotencyKey: tourDraft.idempotencyKey,
      }, {
        resumeUpload: tourDraft.resumeUpload,
        onProgress: setTourProgress,
      });
      if (tourDraft.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
      toast.success('Peek uploaded and queued for processing');
      navigate(`/service/${publishedService.id}`);
    } catch (failure) {
      const failedDraft = {
        ...tourDraft,
        status: 'error',
        error: customerErrorMessage(failure, 'TOUR_UPLOAD_FAILED'),
        resumeUpload: failure.resumeUpload || tourDraft.resumeUpload || null,
      };
      setTourDraft(failedDraft);
      toast.error(failedDraft.error);
    } finally {
      setRetryingTour(false);
    }
  };

  const continueWithoutPublishedTour = async () => {
    if (!publishedService?.id || retryingTour || discardingTour) return;
    setDiscardingTour(true);
    try {
      if (tourDraft?.resumeUpload?.tourId) {
        await removeListingTour(tourDraft.resumeUpload.tourId);
      }
      if (tourDraft?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(tourDraft.previewUrl);
      navigate(`/service/${publishedService.id}`);
    } catch (failure) {
      toast.error(failure.message || 'The unfinished Peek could not be discarded');
    } finally {
      setDiscardingTour(false);
    }
  };

  if (publishedService) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <main className="mx-auto max-w-lg space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-success" />
            <div>
              <h1 className="text-xl font-bold">Service published</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your service is saved and remains usable even though its optional Peek upload was interrupted.</p>
            </div>
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <Film className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Peek upload needs attention</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{tourDraft?.error || 'The upload was interrupted.'}</p>
              </div>
            </div>
          </div>
          {tourProgress && <TourUploadProgress progress={tourProgress} />}
          <Button type="button" className="h-12 w-full rounded-xl" onClick={resumePublishedTour} disabled={retryingTour || discardingTour}>
            {retryingTour ? <><Loader2 className="animate-spin" />Resuming Peek upload...</> : <><RotateCcw />Resume Peek upload</>}
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={continueWithoutPublishedTour} disabled={retryingTour || discardingTour}>
            {discardingTour ? <><Loader2 className="animate-spin" />Discarding unfinished Peek...</> : 'Continue without Peek'}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-8">
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => { saveNow(); goBackOrHome(navigate, '/'); }}
            aria-label="Go back"
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Offer a Service</h1>
            <p className="text-sm text-muted-foreground">Your progress is saved automatically on this device.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="service-category">Service category *</Label>
            {taxonomyQuery.isError ? (
              <div className="mt-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">Service categories are temporarily unavailable. No stale fallback list is used.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => taxonomyQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
              </div>
            ) : (
              <Select value={form.category} disabled={taxonomyQuery.isLoading} onValueChange={(value) => {
                setForm((current) => ({ ...current, category: value, subcategory: "", subcategories: [] }));
              }}>
                <SelectTrigger id="service-category" className="mt-1.5 h-11 rounded-xl"><SelectValue placeholder={taxonomyQuery.isLoading ? "Loading categories…" : "Select category"} /></SelectTrigger>
                <SelectContent>
                  {serviceDomains.map((category) => <SelectItem key={category.id} value={category.stableSlug}>{category.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedCategory && (
            <fieldset>
              <legend className="text-sm font-medium">Service types * <span className="text-muted-foreground font-normal">(select all you offer)</span></legend>
              <div className="mt-2 space-y-3">
                {specializationGroups.map((group) => (
                  <div key={group.label}>
                    {group.label !== "Services" && <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>}
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((subcategory) => {
                        const active = form.subcategories.includes(subcategory.stableSlug);
                        return (
                          <button key={subcategory.id} type="button" aria-pressed={active} onClick={() => toggleSubcategory(subcategory.stableSlug)} className={`px-3 py-2 rounded-xl text-sm border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                            {subcategory.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {specializationGroups.length === 0 && <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No active service specializations are currently available in {marketCountry}.</p>}
              </div>
            </fieldset>
          )}

          <div>
            <Label htmlFor="service-title">Title *</Label>
            <Input id="service-title" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Pre-purchase vehicle inspection" className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="service-description">Description</Label>
            <Textarea id="service-description" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe what you offer, experience and turnaround time" className="mt-1.5 rounded-xl min-h-28" />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Service images <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <p className="mt-1 text-xs text-muted-foreground">Show examples of your work. JPG, PNG, or WebP · 5 MB each · up to 6.</p>
            </div>
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-5 text-center hover:border-primary/50 disabled:opacity-60">
              {uploading ? <><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="mt-2 text-sm">Validating and uploading…</span></> : <><Camera className="h-8 w-8 text-muted-foreground" /><span className="mt-2 text-sm font-semibold">Add service images</span></>}
            </button>
            <input ref={imageInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadImages} />
            {media.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map((item, index) => <div key={item.path} className="relative aspect-square overflow-hidden rounded-xl border"><img src={item.previewUrl} alt={`Service image ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2 h-9 w-9" onClick={() => removeImage(item)} aria-label={`Remove service image ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
            {mediaError && <p role="alert" className="text-sm text-destructive">{mediaError}</p>}
          </div>

          <>
            <TourUploader parentType="service" category="service" value={tourDraft} onChange={setTourDraft} disabled={uploading || createMutation.isPending} onBusyChange={setTourBusy} />
            {createMutation.isPending && tourDraft && tourProgress && <TourUploadProgress progress={tourProgress} />}
          </>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="service-pricing-type">Pricing</Label>
              <Select value={form.pricing_type} onValueChange={(value) => update("pricing_type", value)}>
                <SelectTrigger id="service-pricing-type" className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PRICING_TYPES.map((pricing) => <SelectItem key={pricing.value} value={pricing.value}>{pricing.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="service-price">Price</Label>
              <Input id="service-price" type="number" min="0" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="0" disabled={priceDisabled} className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="service-currency">Currency</Label>
              <select id="service-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} - {currency.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="service-location">City / Area</Label>
            {locationsQuery.isError ? (
              <div className="mt-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">Locations are temporarily unavailable.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => locationsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
              </div>
            ) : (
              <select id="service-location" value={form.location_name} disabled={locationsQuery.isLoading} onChange={(event) => update("location_name", event.target.value)} className="mt-1.5 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">{locationsQuery.isLoading ? "Loading cities…" : "Select city"}</option>
                {cities.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
              </select>
            )}
            <label className="mt-2 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 cursor-pointer">
              <span className="text-sm">Can travel to other areas<span className="block text-xs text-muted-foreground">I can work beyond this city</span></span>
              <Switch id="service-can-travel" aria-label="Can travel to other areas" checked={form.can_travel} onCheckedChange={(value) => update("can_travel", value)} />
            </label>
          </div>

          <div>
            <Label htmlFor="service-phone">Phone</Label>
            <Input id="service-phone" name="phone" type="tel" autoComplete="tel" value={form.contact_phone} onChange={(event) => handlePhoneChange(event.target.value)} placeholder="+263..." className="mt-1.5 h-11 rounded-xl" />
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 cursor-pointer">
            <span className="text-sm">WhatsApp same as phone</span>
            <Switch id="service-whatsapp-same" aria-label="WhatsApp same as phone" checked={sameAsPhone} onCheckedChange={toggleSameAsPhone} />
          </label>
          <div>
            <Label htmlFor="service-whatsapp">WhatsApp</Label>
            <Input id="service-whatsapp" name="whatsapp" type="tel" autoComplete="tel" value={form.contact_whatsapp} onChange={(event) => update("contact_whatsapp", event.target.value)} placeholder="+263..." disabled={sameAsPhone} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="service-email">Contact Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="service-email" name="email" type="email" autoComplete="email" value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>

          <Button className="w-full h-12 rounded-xl" disabled={!canSubmit || createMutation.isPending || uploading || tourBusy || taxonomyQuery.isLoading || taxonomyQuery.isError} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? (tourDraft ? "Publishing and uploading..." : "Publishing...") : "Publish Service"}
          </Button>
          {!canSubmit && <p className="text-xs text-muted-foreground text-center">Category, service type, title and a phone or WhatsApp number are required.</p>}
        </div>
      </div>
    </div>
  );
}
