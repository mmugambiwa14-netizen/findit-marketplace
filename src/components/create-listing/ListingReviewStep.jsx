import { useState } from 'react';
import { Film, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import TourUploadProgress from '@/components/tours/TourUploadProgress';
import { getCurrencyConfig } from '@/lib/marketConfig';

function durationLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function ListingReviewStep({
  formData,
  media,
  tourDraft,
  locationName,
  onBack,
  onSubmit,
  submitting,
  submissionProgress,
}) {
  const [accepted, setAccepted] = useState(false);
  const currency = getCurrencyConfig(formData.currency);
  const priceLabel = `${currency.symbol} ${Number(formData.price || 0).toLocaleString()}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Preview listing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Check what buyers will see before publishing.</p>
      </div>

      <article className="overflow-hidden rounded-2xl border bg-card">
        <div className="aspect-[16/10] bg-muted">
          {media[0]?.previewUrl ? <img src={media[0].previewUrl} alt="Listing cover preview" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-bold leading-tight">{formData.title}</h3>
            <p className="whitespace-nowrap text-lg font-extrabold text-primary">{priceLabel}</p>
          </div>
          <p className="line-clamp-4 text-sm text-muted-foreground">{formData.description}</p>
          {locationName && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {locationName}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 capitalize">{formData.listing_type}</span>
            {formData.negotiable && <span className="rounded-full bg-muted px-2.5 py-1">Negotiable</span>}
            <span className="rounded-full bg-muted px-2.5 py-1">{media.length} image{media.length === 1 ? '' : 's'}</span>
            {tourDraft && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                <Film className="h-3.5 w-3.5" />
                Tour · {durationLabel(tourDraft.durationSeconds)}
              </span>
            )}
          </div>
        </div>
      </article>

      {tourDraft && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Film className="h-4 w-4 text-primary" />
            Optional Tour selected
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            FindIt creates the listing first, uploads the video, then processes it separately. A Tour failure will not remove or block the listing.
          </p>
        </div>
      )}

      {submissionProgress && <TourUploadProgress progress={submissionProgress} />}

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Published after technical checks</p>
            <p className="mt-1 text-xs text-muted-foreground">
              FindIt checks required fields, location, currency, ownership and media before publishing. Reports are reviewed after content is live.
            </p>
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
        <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} aria-label="Accept marketplace rules" />
        <span className="text-sm">I confirm this advert and its optional Tour are accurate, I may advertise them, and they follow the marketplace rules.</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={onBack} disabled={submitting}>Back to edit</Button>
        <Button type="button" className="h-12 rounded-xl" onClick={onSubmit} disabled={!accepted || submitting}>
          {submitting ? (tourDraft ? 'Publishing and uploading...' : 'Publishing...') : 'Publish listing'}
        </Button>
      </div>
    </div>
  );
}
