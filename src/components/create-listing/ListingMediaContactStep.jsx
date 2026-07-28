import { useRef, useState } from 'react';
import { Camera, Loader2, Mail, MessageCircle, Phone, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { removeStagedListingImage, uploadListingImage } from '@/services/listingCreationService';
import TourUploader from '@/components/tours/TourUploader';
import StepNav from './StepNav';

export default function ListingMediaContactStep({ formData, update, media, setMedia, tourDraft, setTourDraft, onBack, onContinue }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (media.length + files.length > 20) return setError('A listing can contain up to 20 images.');
    setUploading(true);
    setError('');
    for (const file of files) {
      try {
        const uploaded = await uploadListingImage(file);
        setMedia((current) => [...current, uploaded]);
      } catch (failure) {
        toast.error(failure.message || `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const remove = async (item) => {
    try {
      await removeStagedListingImage(item.path);
      setMedia((current) => current.filter((candidate) => candidate.path !== item.path));
    } catch (failure) {
      toast.error(failure.message || 'Could not remove the image');
    }
  };
  const makeCover = (index) => setMedia((current) => {
    const next = [...current];
    const [selected] = next.splice(index, 1);
    next.unshift(selected);
    return next;
  });
  const continueIfValid = () => {
    if (!media.length) return setError('Add at least one image.');
    if (!formData.contact_phone && !formData.contact_whatsapp && !formData.contact_email) return setError('Add at least one contact method.');
    setError('');
    onContinue();
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Photos and contact</h2><p className="mt-1 text-sm text-muted-foreground">Show the real item and make the next action clear.</p></div>
    <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:border-primary/50 disabled:opacity-60">{uploading ? <><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="mt-2 text-sm">Validating and uploading…</span></> : <><Camera className="h-9 w-9 text-muted-foreground" /><span className="mt-2 text-sm font-semibold">Add listing images</span><span className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP · 5 MB each · up to 20</span></>}</button>
    <input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} />
    {media.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map((item, index) => <div key={item.path} className="relative aspect-square overflow-hidden rounded-xl border"><img src={item.previewUrl} alt={`Listing image ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />{index === 0 && <span className="absolute bottom-2 left-2 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Cover</span>}<div className="absolute right-2 top-2 flex gap-1">{index > 0 && <Button type="button" size="icon" className="h-9 w-9" onClick={() => makeCover(index)} aria-label={`Make image ${index + 1} the cover`}><Star className="h-4 w-4" /></Button>}<Button type="button" size="icon" variant="destructive" className="h-9 w-9" onClick={() => remove(item)} aria-label={`Remove image ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
    <TourUploader
      category={formData.listing_category}
      value={tourDraft}
      onChange={setTourDraft}
      disabled={uploading}
      onBusyChange={setTourBusy}
      onSkip={continueIfValid}
    />
    <div className="space-y-4 border-t pt-5">
      <div><Label htmlFor="contact-phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />Phone</Label><Input id="contact-phone" type="tel" maxLength={40} className="mt-1 h-11 rounded-xl" value={formData.contact_phone || ''} onChange={(event) => update('contact_phone', event.target.value)} placeholder="+263 77 123 4567" /></div>
      <div><Label htmlFor="contact-whatsapp" className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />WhatsApp</Label><Input id="contact-whatsapp" type="tel" maxLength={40} className="mt-1 h-11 rounded-xl" value={formData.contact_whatsapp || ''} onChange={(event) => update('contact_whatsapp', event.target.value)} placeholder="+263 77 123 4567" /></div>
      <div><Label htmlFor="contact-email" className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label><Input id="contact-email" type="email" maxLength={254} className="mt-1 h-11 rounded-xl" value={formData.contact_email || ''} onChange={(event) => update('contact_email', event.target.value)} placeholder="you@example.com" /></div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <StepNav onBack={onBack} onContinue={continueIfValid} disabled={uploading || tourBusy} />
  </div>;
}
