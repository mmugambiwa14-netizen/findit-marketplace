import { useRef, useState } from 'react';
import { Building2, Camera, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InfoHint, { LabelWithHint } from '@/components/ui/info-hint';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { removeStagedMarketplaceImage, uploadMarketplaceImage } from '@/services/marketplaceImagesService';

const BUSINESS_TYPES = [
  { value: 'real_estate_agency', label: 'Real estate agency' },
  { value: 'car_dealership', label: 'Vehicle dealer' },
  { value: 'heavy_machinery_dealer', label: 'Heavy machinery business' },
  { value: 'property_developer', label: 'Property developer' },
  { value: 'other', label: 'Other business' },
];

export default function BusinessProfileForm({ profile, onSubmit, onCancel, isPending, error }) {
  const logoInputRef = useRef(null);
  const [logoUpload, setLogoUpload] = useState(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [form, setForm] = useState({
    company_name: profile?.company_name ?? '',
    business_type: profile?.business_type ?? 'other',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    website: profile?.website ?? '',
    city: profile?.city ?? '',
    address: profile?.address ?? '',
    description: profile?.description ?? '',
    social_links: {
      facebook: profile?.social_links?.facebook ?? '',
      instagram: profile?.social_links?.instagram ?? '',
      linkedin: profile?.social_links?.linkedin ?? '',
      x: profile?.social_links?.x ?? '',
    },
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setSocial = (key, value) => setForm((current) => ({
    ...current,
    social_links: { ...current.social_links, [key]: value },
  }));
  const logoPreview = logoUpload?.previewUrl ?? (!removeExistingLogo ? profile?.avatar_url : null);

  const chooseLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    setLogoError('');
    try {
      if (logoUpload?.path) {
        await removeStagedMarketplaceImage(logoUpload.path, 'business_logo');
      }
      setLogoUpload(await uploadMarketplaceImage(file, 'business_logo'));
      setRemoveExistingLogo(false);
    } catch (failure) {
      setLogoError(failure.message || 'The logo could not be uploaded.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (logoUpload?.path) {
      await removeStagedMarketplaceImage(logoUpload.path, 'business_logo').catch(() => {});
      setLogoUpload(null);
    }
    if (profile?.avatar_storage_path) setRemoveExistingLogo(true);
  };

  const cancel = async () => {
    if (logoUpload?.path) {
      await removeStagedMarketplaceImage(logoUpload.path, 'business_logo').catch(() => {});
    }
    onCancel();
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form, { upload: logoUpload, removeExisting: removeExistingLogo });
      }}
    >
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {logoPreview ? (
            <img src={logoPreview} alt={`${form.company_name || 'Business'} logo`} loading="eager" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <p className="text-sm font-medium">Business logo</p>
            <InfoHint label="Business logo"><p>JPG, PNG, or WebP, 5 MB maximum.</p></InfoHint>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={uploadingLogo || isPending} onClick={() => logoInputRef.current?.click()}>
              {uploadingLogo ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
              {logoPreview ? 'Replace' : 'Add logo'}
            </Button>
            {(logoUpload || profile?.avatar_storage_path) && (
              <Button type="button" size="sm" variant="ghost" disabled={uploadingLogo || isPending} onClick={removeLogo}>
                <Trash2 className="mr-1.5 h-4 w-4" />Remove
              </Button>
            )}
          </div>
          <input ref={logoInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={chooseLogo} />
        </div>
      </div>
      {logoError && <p className="text-sm text-destructive" role="alert">{logoError}</p>}

      <div className="space-y-2">
        <Label htmlFor="business-name">Business name</Label>
        <Input id="business-name" value={form.company_name} onChange={(event) => set('company_name', event.target.value)} maxLength={100} required />
      </div>

      <div className="space-y-2">
        <LabelWithHint
          htmlFor="business-type"
          hint={<p>Vehicle dealers receive a searchable vehicle inventory page. No special account role is created.</p>}
        >Profile type</LabelWithHint>
        <Select value={form.business_type} onValueChange={(value) => set('business_type', value)}>
          <SelectTrigger id="business-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <LabelWithHint
            htmlFor="business-phone"
            hintLabel="Business contact"
            hint={<p>Provide at least one contact method so buyers can reach the business.</p>}
          >Phone</LabelWithHint>
          <Input id="business-phone" type="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} maxLength={40} placeholder="+263 ..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-email">Email</Label>
          <Input id="business-email" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} maxLength={254} placeholder="hello@example.co.zw" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-description">Description</Label>
        <Textarea id="business-description" value={form.description} onChange={(event) => set('description', event.target.value)} maxLength={1000} rows={5} placeholder="What does your business offer?" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business-city">City or area</Label>
          <Input id="business-city" value={form.city} onChange={(event) => set('city', event.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-address">Public address (optional)</Label>
          <Input id="business-address" value={form.address} onChange={(event) => set('address', event.target.value)} maxLength={300} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business-website">Website (optional)</Label>
        <Input id="business-website" type="url" value={form.website} onChange={(event) => set('website', event.target.value)} placeholder="https://example.co.zw" />
      </div>

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Social links (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['facebook', 'Facebook'],
            ['instagram', 'Instagram'],
            ['linkedin', 'LinkedIn'],
            ['x', 'X'],
          ].map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`social-${key}`}>{label}</Label>
              <Input id={`social-${key}`} type="url" value={form.social_links[key]} onChange={(event) => setSocial(key, event.target.value)} placeholder="https://..." />
            </div>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-destructive" role="alert">{error.message || 'We could not save this profile.'}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {profile && <Button type="button" variant="outline" onClick={cancel} disabled={isPending || uploadingLogo}>Cancel</Button>}
        <Button type="submit" disabled={isPending || uploadingLogo}>{isPending ? 'Saving…' : profile ? 'Save profile' : 'Create profile'}</Button>
      </div>
    </form>
  );
}
