import { AlertTriangle, CheckCircle2, Clock3, Film, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TourUploadProgress from '@/components/tours/TourUploadProgress';

export default function PublishSuccess({
  listing,
  onPostAnother,
  onRetryTour,
  retryingTour = false,
  onDiscardTour = null,
  discardingTour = false,
  tourProgress,
}) {
  const tour = listing.tourDraft;
  return <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center space-y-6 px-4 py-12 text-center">
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"><CheckCircle2 className="h-10 w-10 text-primary" /></div>
    <div><h1 className="text-2xl font-extrabold">Your advert was submitted</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">It is waiting for a quick marketplace review and is not public yet. FindIt will notify you when it is approved or if changes are needed.</p></div>
    <div className="w-full rounded-2xl border bg-card p-4 text-left">{listing.photos?.[0] && <img src={listing.photos[0]} alt="" className="mb-3 h-40 w-full rounded-xl object-cover" />}<p className="font-bold">{listing.title}</p><p className="mt-1 font-extrabold text-primary">USD {Number(listing.price).toLocaleString()}</p><p className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Clock3 className="h-4 w-4" />Status: Pending review</p></div>

    {tour?.status === 'uploaded' && <div className="w-full rounded-xl border border-success/25 bg-success/5 p-4 text-left"><p className="flex items-center gap-2 text-sm font-semibold"><Film className="h-4 w-4 text-success" />Tour uploaded</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">The listing is safe while the Tour is processed and reviewed. It will appear only when both the video and parent listing are eligible.</p></div>}
    {tour?.status === 'error' && <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left" role="alert"><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" />The listing succeeded, but the Tour upload did not finish</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tour.error || 'The video upload was interrupted.'}</p>{tourProgress && <div className="mt-3"><TourUploadProgress progress={tourProgress} /></div>}<div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={onRetryTour} disabled={retryingTour || discardingTour}>{retryingTour ? <Loader2 className="animate-spin" /> : <RotateCcw />}Resume Tour upload</Button>{onDiscardTour && <Button type="button" size="sm" variant="ghost" onClick={onDiscardTour} disabled={retryingTour || discardingTour}>{discardingTour ? <Loader2 className="animate-spin" /> : <Trash2 />}Discard unfinished Tour</Button>}</div></div>}

    <div className="grid w-full gap-2"><Button asChild className="h-11 rounded-xl"><Link to="/my-listings">Manage my listings</Link></Button><Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onPostAnother}>Post another listing</Button></div>
  </div>;
}
